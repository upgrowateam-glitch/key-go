import { BadRequestException, ConflictException, GoneException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { dateOnly } from '../common/dates';
import { roleEnum } from '../common/enums';
import { customerToApi, normaliseEmail, normalisePhone } from '../domain/mappers';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from './auth.decorators';
import type { RegisterCustomerDto } from './auth.dto';
import { hashInvite } from './invites';
import { permissionsFor } from './permissions';

const BAD_LOGIN = 'Incorrect email or password.';
/** Wrong passwords in a row before sign-in pauses, and for how long. */
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
/** Sign-in attempts from one network address per window, across all accounts. */
const IP_LIMIT = 30;
const IP_WINDOW_MS = 15 * 60 * 1000;

type Account = { id: string; passwordHash: string | null; failedLogins: number; lockedUntil: Date | null };

@Injectable()
export class AuthService {
  private readonly ipAttempts = new Map<string, { count: number; since: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sign(payload: AuthPayload) {
    return this.jwt.signAsync({ sub: payload.sub, kind: payload.kind, role: payload.role, name: payload.name, ver: payload.ver ?? 0 });
  }

  staffSession(user: { id: string; name: string; email: string; role: Parameters<typeof roleEnum.fromDb>[0]; driverId?: string | null }) {
    const role = roleEnum.fromDb(user.role);
    return { id: user.id, name: user.name, email: user.email, role, driverId: user.driverId ?? null, permissions: permissionsFor(role) };
  }

  // ---------------------------------------------------------------- wrong-password protection

  /** Limits how fast one network address can try passwords. */
  checkIp(ip: string | undefined) {
    if (!ip) return;
    const now = Date.now();
    const entry = this.ipAttempts.get(ip);
    if (!entry || now - entry.since > IP_WINDOW_MS) {
      this.ipAttempts.set(ip, { count: 1, since: now });
      if (this.ipAttempts.size > 10_000) this.ipAttempts.clear();
      return;
    }
    entry.count += 1;
    if (entry.count > IP_LIMIT) throw new HttpException('Too many sign-in attempts. Please wait 15 minutes and try again.', HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Checks a password, counting failures and pausing the account after too many. */
  private async verifyPassword(account: Account | null, password: string, kind: 'user' | 'customer') {
    if (account?.lockedUntil && account.lockedUntil > new Date()) {
      const minutes = Math.ceil((account.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(`Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const ok = !!account?.passwordHash && (await compare(password, account.passwordHash));
    if (!account) return false;
    const model = kind === 'user' ? this.prisma.user : this.prisma.customer;
    if (ok) {
      if (account.failedLogins || account.lockedUntil) await (model as typeof this.prisma.user).update({ where: { id: account.id }, data: { failedLogins: 0, lockedUntil: null } });
      return true;
    }
    const failed = account.failedLogins + 1;
    await (model as typeof this.prisma.user).update({
      where: { id: account.id },
      data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
    });
    if (failed >= MAX_FAILED) throw new HttpException(`Too many wrong passwords. Sign-in is paused for ${LOCK_MINUTES} minutes.`, HttpStatus.TOO_MANY_REQUESTS);
    return false;
  }

  // ---------------------------------------------------------------- staff

  async staffLogin(email: string, password: string, ip?: string) {
    this.checkIp(ip);
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!(await this.verifyPassword(user, password, 'user')) || !user || !user.active) throw new UnauthorizedException(BAD_LOGIN);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = this.staffSession(user);
    return { token: await this.sign({ sub: user.id, kind: 'staff', role: session.role, name: user.name, ver: user.tokenVersion }), user: session };
  }

  // ---------------------------------------------------------------- invitations

  private async openInvite(token: string) {
    const user = token ? await this.prisma.user.findUnique({ where: { inviteTokenHash: hashInvite(token) } }) : null;
    if (!user || !user.active) throw new NotFoundException('This invitation link is not valid. Ask for a new one.');
    if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) throw new GoneException('This invitation link has expired. Ask your Owner or Admin for a new one.');
    return user;
  }

  /** Who an invitation is for, so the page can greet them. */
  async describeInvite(token: string, ip?: string) {
    this.checkIp(ip);
    const user = await this.openInvite(token);
    return { name: user.name, email: user.email, role: roleEnum.fromDb(user.role) };
  }

  /** Sets the person's password from their invitation and signs them in. The link then stops working. */
  async acceptInvite(token: string, password: string, ip?: string) {
    this.checkIp(ip);
    const user = await this.openInvite(token);
    const saved = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(password, 10),
        inviteTokenHash: null,
        inviteExpiresAt: null,
        tokenVersion: { increment: 1 },
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
    const session = this.staffSession(saved);
    return { token: await this.sign({ sub: saved.id, kind: 'staff', role: session.role, name: saved.name, ver: saved.tokenVersion }), user: session };
  }

  // ---------------------------------------------------------------- customers

  async customerLogin(email: string, password: string, ip?: string) {
    this.checkIp(ip);
    const customer = await this.prisma.customer.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!(await this.verifyPassword(customer, password, 'customer')) || !customer) throw new UnauthorizedException(BAD_LOGIN);
    return { token: await this.sign({ sub: customer.id, kind: 'customer', name: customer.firstName, ver: customer.tokenVersion }), customer: customerToApi(customer) };
  }

  async registerCustomer(input: RegisterCustomerDto) {
    const email = normaliseEmail(input.email)!;
    const phone = normalisePhone(input.phone)!;
    if (await this.prisma.customer.count({ where: { email } })) {
      throw new ConflictException('An account with this email already exists. Sign in instead, or contact KeyGo support.');
    }
    if (await this.prisma.customer.count({ where: { phone } })) {
      throw new ConflictException('An account with this phone number already exists. Sign in instead, or contact KeyGo support.');
    }
    const firstName = input.firstName.trim();
    const customer = await this.prisma.customer.create({
      data: {
        firstName,
        lastName: input.lastName.trim(),
        email,
        phone,
        dob: dateOnly(input.dob),
        passwordHash: await hash(input.password, 10),
        customerCode: await this.freeCustomerCode(firstName),
        trustRating: 0,
      },
    });
    return { token: await this.sign({ sub: customer.id, kind: 'customer', name: customer.firstName, ver: 0 }), customer: customerToApi(customer) };
  }

  // ---------------------------------------------------------------- password and sessions (both kinds)

  /** Changes the caller's password and signs out every other device; returns a fresh token for this one. */
  async changePassword(me: AuthPayload, current: string, next: string) {
    if (current === next) throw new BadRequestException('Choose a new password that is different from the current one.');
    if (me.kind === 'staff') {
      const user = await this.prisma.user.findUnique({ where: { id: me.sub } });
      if (!user || !(await compare(current, user.passwordHash))) throw new BadRequestException('Your current password is not correct.');
      const saved = await this.prisma.user.update({ where: { id: me.sub }, data: { passwordHash: await hash(next, 10), tokenVersion: { increment: 1 } } });
      return { token: await this.sign({ ...me, ver: saved.tokenVersion }) };
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: me.sub } });
    if (!customer?.passwordHash || !(await compare(current, customer.passwordHash))) throw new BadRequestException('Your current password is not correct.');
    const saved = await this.prisma.customer.update({ where: { id: me.sub }, data: { passwordHash: await hash(next, 10), tokenVersion: { increment: 1 } } });
    return { token: await this.sign({ ...me, ver: saved.tokenVersion }) };
  }

  /** Signs the caller out on every device, including this one. */
  async signOutEverywhere(me: AuthPayload) {
    if (me.kind === 'staff') await this.prisma.user.update({ where: { id: me.sub }, data: { tokenVersion: { increment: 1 } } });
    else await this.prisma.customer.update({ where: { id: me.sub }, data: { tokenVersion: { increment: 1 } } });
  }

  /** Referral code like "KGANA482", unique across customers. */
  private async freeCustomerCode(firstName: string) {
    const stem = `KG${firstName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CUS'}`;
    for (let i = 0; i < 20; i++) {
      const code = `${stem}${Math.floor(100 + Math.random() * 900)}`;
      if (!(await this.prisma.customer.count({ where: { customerCode: code } }))) return code;
    }
    return `${stem}${Date.now().toString(36).toUpperCase()}`;
  }
}
