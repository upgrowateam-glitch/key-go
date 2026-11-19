import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { roleEnum, type StaffRoleLabel } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_AREA, AUTH_KIND, AUTH_ROLES, type AuthPayload } from './auth.decorators';
import { AREA_LABELS, can, type Access, type Area } from './permissions';

/** Header carrying a fresh token when the caller's token is getting old (sliding sign-in). */
export const RENEWED_TOKEN_HEADER = 'X-KeyGo-Token';
const RENEW_AFTER_SECONDS = 24 * 60 * 60;

/**
 * Applied to every route. Routes marked @StaffOnly, @Can, @CustomerOnly or @SignedIn need a valid bearer
 * token of that kind. Every request re-checks the account in the database, so a deactivated account, a changed
 * role or "sign out of all devices" takes effect immediately. Unmarked routes are public.
 *
 * Tokens older than a day are renewed: the response carries a new one in the X-KeyGo-Token header, so people
 * who use KeyGo regularly stay signed in, while an unused sign-in expires after JWT_ACCESS_TTL (7 days).
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
    const kind = this.reflector.getAllAndOverride<AuthPayload['kind'] | 'any' | undefined>(AUTH_KIND, targets);
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
    if (kind !== 'any' && payload.kind !== kind) throw new ForbiddenException('This account cannot use this part of KeyGo.');

    if (payload.kind === 'staff') {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.active) throw new UnauthorizedException('This staff account is no longer active.');
      if ((payload.ver ?? 0) !== user.tokenVersion) throw new UnauthorizedException('You were signed out. Please sign in again.');
      payload.role = roleEnum.fromDb(user.role);
      payload.name = user.name;
      payload.driverId = user.driverId;
      payload.ver = user.tokenVersion;

      const roles = this.reflector.getAllAndOverride<StaffRoleLabel[] | undefined>(AUTH_ROLES, targets);
      if (roles?.length && !roles.includes(payload.role)) throw new ForbiddenException(`Only ${roles.join(' or ')} accounts can do this.`);
      // Driver logins only reach routes that name the Driver role (their own driver page and session)
      if (payload.role === 'Driver' && kind !== 'any' && !roles?.includes('Driver')) throw new ForbiddenException('Driver accounts can only use the driver page.');
      const need = this.reflector.getAllAndOverride<{ area: Area; access: Exclude<Access, 'none'> } | undefined>(AUTH_AREA, targets);
      if (need && !can(payload.role, need.area, need.access)) {
        throw new ForbiddenException(`Your ${payload.role} account cannot ${need.access === 'edit' ? 'change' : 'open'} ${AREA_LABELS[need.area]}.`);
      }
    } else {
      const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true } });
      if (!customer) throw new UnauthorizedException('This account no longer exists.');
      if ((payload.ver ?? 0) !== customer.tokenVersion) throw new UnauthorizedException('You were signed out. Please sign in again.');
      payload.ver = customer.tokenVersion;
    }

    if (payload.iat && Date.now() / 1000 - payload.iat > RENEW_AFTER_SECONDS) {
      const renewed = await this.jwt.signAsync({ sub: payload.sub, kind: payload.kind, role: payload.role, name: payload.name, ver: payload.ver });
      ctx.switchToHttp().getResponse().setHeader(RENEWED_TOKEN_HEADER, renewed);
    }

    req.auth = payload;
    return true;
  }
}
