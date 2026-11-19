import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { StaffRoleLabel } from '../common/enums';
import type { Access, Area } from './permissions';

/** What a valid access token says about the caller. */
export interface AuthPayload {
  sub: string;
  kind: 'staff' | 'customer';
  role?: StaffRoleLabel;
  name: string;
  /** The account's token version when the token was issued; raising it signs every device out. */
  ver?: number;
  /** For Driver accounts: the driver record they belong to (filled in by the guard). */
  driverId?: string | null;
  /** Issued-at (seconds), set by the JWT library. */
  iat?: number;
}

export const AUTH_KIND = 'keygo:auth-kind';
export const AUTH_ROLES = 'keygo:auth-roles';
export const AUTH_AREA = 'keygo:auth-area';

/** Staff of the admin portal only; optionally limited to some roles. */
export const StaffOnly = (...roles: StaffRoleLabel[]) =>
  applyDecorators(SetMetadata(AUTH_KIND, 'staff'), ...(roles.length ? [SetMetadata(AUTH_ROLES, roles)] : []));

/** Staff who may view or edit one area of the portal (see permissions.ts). */
export const Can = (area: Area, access: Exclude<Access, 'none'>) => applyDecorators(SetMetadata(AUTH_KIND, 'staff'), SetMetadata(AUTH_AREA, { area, access }));

/** Signed-in customers of the app only. */
export const CustomerOnly = () => SetMetadata(AUTH_KIND, 'customer');

/** Any signed-in staff member or customer (for password change and signing out everywhere). */
export const SignedIn = () => SetMetadata(AUTH_KIND, 'any');

/** The caller, as verified by the AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthPayload => ctx.switchToHttp().getRequest().auth);
