import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ModuleRef } from "@nestjs/core";
import { IS_PUBLIC_KEY, LICENSE_EXEMPT_KEY } from "../../../common/decorators";
import { Model } from "mongoose";
import { LicenseAuthorityService } from "../../license-authority/license-authority.service";

export interface JwtAuthPayload {
  sub: string;
  role: string;
  type: "access" | "refresh";
  tv?: number;
  permissions?: string[];
}

const ADMIN_ROLE_SET = new Set(["super_admin", "admin"]);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private userModel: Model<any> | null = null;
  private licenseAuthority: any = null;
  private resolved = false;
  private licenseResolved = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    @Optional()
    private readonly licenseAuthorityService?: LicenseAuthorityService,
  ) {}

  private getModel(): Model<any> | null {
    if (this.resolved) return this.userModel;
    this.resolved = true;
    try {
      this.userModel = this.moduleRef.get("UserModel", { strict: false });
    } catch {
      this.userModel = null;
    }
    return this.userModel;
  }

  private getLicenseAuthority(): any {
    if (this.licenseResolved) return this.licenseAuthority;
    this.licenseResolved = true;
    if (this.licenseAuthorityService) {
      this.licenseAuthority = this.licenseAuthorityService;
      return this.licenseAuthority;
    }
    try {
      this.licenseAuthority = this.moduleRef.get(
        LicenseAuthorityService,
        { strict: false },
      );
    } catch {
      this.licenseAuthority = null;
    }
    return this.licenseAuthority;
  }

  private isLicenseExempt(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(LICENSE_EXEMPT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) return false;

    try {
      const payload = await this.jwtService.verifyAsync<JwtAuthPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (payload.type !== "access") return false;

      if (ADMIN_ROLE_SET.has(payload.role)) {
        const userModel = this.getModel();
        if (!userModel) return false;
        const user = (await userModel
          .findById(payload.sub)
          .select("role status permissions tokenVersion email")
          .lean()) as any;
        if (!user) return false;
        if (user.status !== "active") return false;
        if (
          user.tokenVersion != null &&
          payload.tv != null &&
          user.tokenVersion !== payload.tv
        ) {
          return false;
        }

        // ADMIN (non-super_admin) requests must carry a valid assigned license.
        // Super Admin is always exempt; /auth/me + license routes are exempt
        // so an unlicensed Admin can see why access is denied.
        if (
          user.role === "admin" &&
          !this.isLicenseExempt(context)
        ) {
          const authority = this.getLicenseAuthority();
          if (authority) {
            const access = await authority.resolveAdminAccess(
              String(user._id),
              user.email,
            );
            if (!access?.granted) {
              throw new ForbiddenException({
                error: access?.code ?? "LICENSE_REQUIRED",
                message: access?.message ?? "Admin license required for panel access.",
              });
            }
            request.adminLicense = access;
          }
        }

        request.user = {
          id: payload.sub,
          role: user.role,
          status: user.status,
          permissions: user.permissions ?? [],
          email: user.email,
          payload,
        };
      } else {
        request.user = { id: payload.sub, role: payload.role, payload };
      }
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      return false;
    }
  }

  private extractToken(request: any): string | undefined {
    const auth = request?.headers?.authorization;
    if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
      return auth.slice(7);
    }
    return undefined;
  }
}