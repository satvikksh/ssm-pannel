import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../../../common/decorators";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException("Not authenticated");

    // Panel roles (Super Admin AND Admin) map to the full panel experience.
    // License enforcement for ADMIN is handled separately in JwtAuthGuard, so a
    // normal Admin is NOT blocked here — otherwise unlicensed Admins couldn't
    // even reach the "license required" screen.
    if (user.role === "super_admin" || user.role === "admin") return true;

    const userPermissions: string[] = Array.isArray(user.permissions)
      ? user.permissions
      : Array.isArray(user.payload?.permissions)
        ? user.payload.permissions
        : [];

    if (required.every((p) => userPermissions.includes(p))) return true;

    throw new ForbiddenException("Insufficient permissions");
  }
}