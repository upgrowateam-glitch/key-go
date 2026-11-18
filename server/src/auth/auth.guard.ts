import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { roleEnum, type StaffRoleLabel } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_KIND, AUTH_ROLES, type AuthPayload } from './auth.decorators';

/**
 * Applied to every route. Routes marked @StaffOnly or @CustomerOnly need a valid bearer token of that kind;
 * staff accounts are re-checked against the database, so a deactivated account loses access immediately.
 * Unmarked routes are public.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const kind = this.reflector.getAllAndOverride<AuthPayload['kind'] | undefined>(AUTH_KIND, targets);
    if (!kind) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Please sign in.');

    let payload: AuthPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthPayload>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    if (payload.kind !== kind) throw new ForbiddenException('This account cannot use this part of KeyGo.');

    if (kind === 'staff') {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.active) throw new UnauthorizedException('This staff account is no longer active.');
      payload.role = roleEnum.fromDb(user.role);
      payload.name = user.name;
      const roles = this.reflector.getAllAndOverride<StaffRoleLabel[] | undefined>(AUTH_ROLES, targets);
      if (roles?.length && !roles.includes(payload.role)) throw new ForbiddenException(`Only ${roles.join(' or ')} accounts can do this.`);
    } else {
      const exists = await this.prisma.customer.count({ where: { id: payload.sub } });
      if (!exists) throw new UnauthorizedException('This account no longer exists.');
    }

    req.auth = payload;
    return true;
  }
}
