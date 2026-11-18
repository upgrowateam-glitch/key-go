import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { StaffRoleLabel } from '../common/enums';

/** What a valid access token says about the caller. */
export interface AuthPayload {
  sub: string;
  kind: 'staff' | 'customer';
  role?: StaffRoleLabel;
  name: string;
}

export const AUTH_KIND = 'keygo:auth-kind';
export const AUTH_ROLES = 'keygo:auth-roles';

/** Staff of the admin portal only; optionally limited to some roles. */
export const StaffOnly = (...roles: StaffRoleLabel[]) =>
  applyDecorators(SetMetadata(AUTH_KIND, 'staff'), ...(roles.length ? [SetMetadata(AUTH_ROLES, roles)] : []));

/** Signed-in customers of the app only. */
export const CustomerOnly = () => SetMetadata(AUTH_KIND, 'customer');

/** The caller, as verified by the AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthPayload => ctx.switchToHttp().getRequest().auth);
