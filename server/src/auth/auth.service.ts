import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { dateOnly } from '../common/dates';
import { roleEnum } from '../common/enums';
import { customerToApi, normaliseEmail, normalisePhone } from '../domain/mappers';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from './auth.decorators';
import type { RegisterCustomerDto } from './auth.dto';

const BAD_LOGIN = 'Incorrect email or password.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sign(payload: AuthPayload) {
    return this.jwt.signAsync(payload);
  }

  staffSession(user: { id: string; name: string; email: string; role: Parameters<typeof roleEnum.fromDb>[0] }) {
    return { id: user.id, name: user.name, email: user.email, role: roleEnum.fromDb(user.role) };
  }

  async staffLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.active || !(await compare(password, user.passwordHash))) throw new UnauthorizedException(BAD_LOGIN);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = this.staffSession(user);
    return { token: await this.sign({ sub: user.id, kind: 'staff', role: session.role, name: user.name }), user: session };
  }

  async customerLogin(email: string, password: string) {
    const customer = await this.prisma.customer.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!customer?.passwordHash || !(await compare(password, customer.passwordHash))) throw new UnauthorizedException(BAD_LOGIN);
    return { token: await this.sign({ sub: customer.id, kind: 'customer', name: customer.firstName }), customer: customerToApi(customer) };
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
    return { token: await this.sign({ sub: customer.id, kind: 'customer', name: customer.firstName }), customer: customerToApi(customer) };
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
