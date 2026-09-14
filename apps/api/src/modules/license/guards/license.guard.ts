import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { LicenseService } from "@smm/domain";
import { IS_PUBLIC_KEY } from "../../../common/decorators";

/**
 * Enforces the panel license on protected routes. Public routes (login,
 * health, license activation, settings the storefront needs) bypass this.
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenseService: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const { licensed, status } = await this.licenseService.isLicensed();
    if (!licensed) {
      throw new ForbiddenException(`Panel license is not active (${status})`);
    }
    return true;
  }
}