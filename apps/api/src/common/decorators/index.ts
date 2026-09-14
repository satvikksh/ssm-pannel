import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = "permissions";
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const LICENSE_EXEMPT_KEY = "licenseExempt";
/**
 * Marks a route as exempt from the admin-license gate. Use ONLY for routes an
 * unlicensed (or not-yet-approved) ADMIN must still reach — e.g. /auth/me and
 * the license status/activation endpoints. Never use on business routes.
 */
export const LicenseExempt = () => SetMetadata(LICENSE_EXEMPT_KEY, true);

export interface AuthUser {
  id: string;
  role: string;
  permissions?: string[];
  email?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);