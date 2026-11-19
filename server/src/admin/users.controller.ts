import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { hash } from 'bcryptjs';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Can, CurrentUser, type AuthPayload } from '../auth/auth.decorators';
import { newInvite, unusablePassword } from '../auth/invites';
import { roleEnum, type StaffRoleLabel } from '../common/enums';
import { StoreService } from '../domain/store.service';
import { StaffSyncService } from '../domain/staff-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { whatsappDigits, WhatsAppService } from '../whatsapp/whatsapp.service';

const PHONE = /^\+?[0-9\s-]{10,16}$/;

class InviteDto {
  /** Send the invitation on WhatsApp from KeyGo's linked number. */
  @IsOptional() @IsBoolean() sendWhatsApp?: boolean;
  /** The admin site address the link should open (window.location.origin). */
  @IsOptional() @IsString() @MaxLength(200) inviteBaseUrl?: string;
}

const ROLES: StaffRoleLabel[] = ['Owner', 'Admin', 'Manager', 'Staff', 'Driver'];

class CreateUserDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  /** Optional when a WhatsApp number is given; either can be used to sign in. */
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address.' }) email?: string;
  @IsOptional() @Matches(PHONE, { message: 'Enter a valid WhatsApp number.' }) phone?: string;
  @IsIn(ROLES) role: StaffRoleLabel;
  @IsOptional() @IsString() @MaxLength(80) branch?: string;
  /** Driver accounts: the driver record this login belongs to. */
  @IsOptional() @IsString() @MaxLength(80) driverId?: string;
  /** Leave out to send an invitation link instead; the person then sets their own password. */
  @IsOptional() @IsString() @MinLength(8, { message: 'Use at least 8 characters for the password.' }) password?: string;
  @IsOptional() @IsBoolean() sendWhatsApp?: boolean;
  @IsOptional() @IsString() @MaxLength(200) inviteBaseUrl?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsIn(ROLES) role?: StaffRoleLabel;
  @IsOptional() @IsString() @MaxLength(80) branch?: string;
  @IsOptional() @IsString() @MaxLength(80) driverId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(8, { message: 'Use at least 8 characters for the password.' }) password?: string;
}

const lastActive = (d: Date | null) => {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

const toApi = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email ?? '',
  phone: u.phone ? `+${u.phone}` : '',
  role: roleEnum.fromDb(u.role),
  branch: u.branchName ?? '',
  driverId: u.driverId ?? null,
  active: u.active,
  lastActive: lastActive(u.lastLoginAt),
  /** Waiting for the person to open their invitation link and set a password. */
  invitePending: !!u.inviteTokenHash,
  inviteExpiresAt: u.inviteExpiresAt?.toISOString() ?? null,
});

/** Staff accounts that can sign in to the admin portal. Owners and Admins manage them; only Owners manage Owners. */
@ApiTags('admin')
@ApiBearerAuth()
@Can('users', 'edit')
@Controller('admin/users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly whatsapp: WhatsAppService,
    private readonly staffSync: StaffSyncService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'All staff accounts' })
  async list() {
    return (await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map(toApi);
  }

  @Post()
  @ApiOperation({ summary: 'Create a staff account, with a starting password or (no password) a one-time invitation link' })
  async create(@Body() body: CreateUserDto, @CurrentUser() me: AuthPayload) {
    if (body.role === 'Owner' && me.role !== 'Owner') throw new ForbiddenException('Only an Owner can create another Owner.');
    const email = body.email?.trim().toLowerCase() || null;
    const phone = body.phone ? whatsappDigits(body.phone) : null;
    if (!email && !phone) throw new BadRequestException('Enter an email or a WhatsApp number.');
    if (email && (await this.prisma.user.count({ where: { email } }))) throw new ConflictException('A staff account with this email already exists.');
    if (phone && (await this.prisma.user.count({ where: { phone } }))) throw new ConflictException('A staff account with this WhatsApp number already exists.');
    if (body.sendWhatsApp && !phone) throw new BadRequestException('Enter a WhatsApp number to send the invitation on WhatsApp.');
    const driverId = await this.checkDriver(body.role, body.driverId);
    const invite = body.password ? null : newInvite();
    const user = await this.prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        phone,
        role: roleEnum.toDb(body.role),
        branchName: body.branch?.trim() || null,
        driverId,
        passwordHash: await hash(body.password ?? unusablePassword(), 10),
        inviteTokenHash: invite?.hash,
        inviteExpiresAt: invite?.expiresAt,
      },
    });
    await this.staffSync.sync(user);
    // The invitation token is returned only here; the server keeps just its hash
    const sent = invite && body.sendWhatsApp ? await this.sendInviteMessage(user, invite.token, body.inviteBaseUrl) : undefined;
    return { ...toApi(user), inviteToken: invite?.token, ...sent };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change name, role, branch, active state or password' })
  async update(@Param('id') id: string, @Body() body: UpdateUserDto, @CurrentUser() me: AuthPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Staff account not found.');
    const touchesOwner = user.role === 'OWNER' || body.role === 'Owner';
    if (touchesOwner && me.role !== 'Owner') throw new ForbiddenException('Only an Owner can change an Owner account.');

    const losesOwner = user.role === 'OWNER' && user.active && (body.active === false || (body.role !== undefined && body.role !== 'Owner'));
    if (losesOwner && (await this.prisma.user.count({ where: { role: 'OWNER', active: true } })) <= 1) {
      throw new BadRequestException('KeyGo needs at least one active Owner account.');
    }
    if (id === me.sub && body.active === false) throw new BadRequestException('You cannot deactivate your own account.');
    const role = body.role ?? roleEnum.fromDb(user.role);
    const driverId = role === 'Driver' ? await this.checkDriver(role, body.driverId ?? user.driverId ?? undefined, id) : null;
    // A new password, a role change or deactivation signs the person out on every device
    const signOut = !!body.password || (body.role !== undefined && body.role !== roleEnum.fromDb(user.role)) || body.active === false;

    const saved = await this.prisma.user.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        role: body.role ? roleEnum.toDb(body.role) : undefined,
        branchName: body.branch === undefined ? undefined : body.branch.trim() || null,
        active: body.active,
        driverId,
        phone: body.phone === undefined ? undefined : body.phone.trim() ? whatsappDigits(body.phone) : null,
        passwordHash: body.password ? await hash(body.password, 10) : undefined,
        tokenVersion: signOut ? { increment: 1 } : undefined,
        failedLogins: body.password ? 0 : undefined,
        lockedUntil: body.password ? null : undefined,
        // Setting a password by hand replaces any open invitation
        inviteTokenHash: body.password ? null : undefined,
        inviteExpiresAt: body.password ? null : undefined,
      },
    });
    await this.staffSync.sync(saved);
    return toApi(saved);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Make a new invitation link (the old one stops working), optionally sending it on WhatsApp' })
  async invite(@Param('id') id: string, @CurrentUser() me: AuthPayload, @Body() body: InviteDto = {}) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Staff account not found.');
    if (user.role === 'OWNER' && me.role !== 'Owner') throw new ForbiddenException('Only an Owner can invite an Owner.');
    if (!user.active) throw new BadRequestException('Enable this account before sending an invitation.');
    if (id === me.sub) throw new BadRequestException('Use Change password in your account menu instead.');
    const invite = newInvite();
    const saved = await this.prisma.user.update({ where: { id }, data: { inviteTokenHash: invite.hash, inviteExpiresAt: invite.expiresAt } });
    if (body.sendWhatsApp && !saved.phone) throw new BadRequestException('Add a WhatsApp number for this person first.');
    const sent = body.sendWhatsApp ? await this.sendInviteMessage(saved, invite.token, body.inviteBaseUrl) : undefined;
    return { ...toApi(saved), inviteToken: invite.token, ...sent };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a staff account (or cancel an invitation that was not accepted yet)' })
  async remove(@Param('id') id: string, @CurrentUser() me: AuthPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Staff account not found.');
    if (id === me.sub) throw new BadRequestException('You cannot delete your own account.');
    if (user.role === 'OWNER' && me.role !== 'Owner') throw new ForbiddenException('Only an Owner can delete an Owner account.');
    if (user.role === 'OWNER' && user.active && (await this.prisma.user.count({ where: { role: 'OWNER', active: true } })) <= 1) {
      throw new BadRequestException('KeyGo needs at least one active Owner account.');
    }
    // Their sign-in stops working at once: the guard finds no account for their token
    await this.prisma.user.delete({ where: { id } });
    await this.staffSync.remove(id);
  }

  /** The address invitation links point at: the admin site the request came from, if it is one of ours. */
  private inviteBase(requested?: string) {
    const allowed = (this.config.get<string>('CORS_ORIGINS') ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
    const wanted = requested?.trim().replace(/\/$/, '');
    if (wanted && /^https?:\/\//.test(wanted) && (allowed.length === 0 || allowed.includes(wanted))) return wanted;
    const admin = allowed.find((o) => o.startsWith('https://') && o.includes('admin'));
    if (!admin) throw new BadRequestException('Cannot tell which admin site the invitation should open.');
    return admin;
  }

  /** Sends the invitation on WhatsApp. The account is created either way; a failure is reported, not thrown. */
  private async sendInviteMessage(user: User, token: string, base?: string) {
    const link = `${this.inviteBase(base)}/invite?token=${encodeURIComponent(token)}`;
    const role = roleEnum.fromDb(user.role);
    const text = `Hi ${user.name.split(' ')[0]}, you've been added to KeyGo Admin as ${role === 'Owner' ? 'Owner (Super Admin)' : role}.\n\nOpen this link to choose your password and sign in (it works once, for 7 days):\n${link}`;
    try {
      const r = await this.whatsapp.sendText(user.phone!, text);
      return { whatsappSent: true, whatsappTo: r.to };
    } catch (e) {
      return { whatsappSent: false, whatsappError: (e as Error).message };
    }
  }

  /** A Driver login must point at an existing driver record, and only one login per driver. */
  private async checkDriver(role: StaffRoleLabel, driverId: string | undefined, exceptUserId?: string) {
    if (role !== 'Driver') return null;
    if (!driverId) throw new BadRequestException('Choose which driver this account belongs to.');
    if (!(await this.store.get('drivers', driverId))) throw new BadRequestException('That driver was not found. Add the driver under Drivers & Staff first.');
    if (await this.prisma.user.count({ where: { driverId, id: exceptUserId ? { not: exceptUserId } : undefined } })) throw new ConflictException('This driver already has a sign-in account.');
    return driverId;
  }
}
