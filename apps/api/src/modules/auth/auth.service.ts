import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ModuleRef } from "@nestjs/core";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { hashPassword, verifyPassword, signJwt, randomSecret } from "@smm/security";
import { RegisterDto, LoginDto } from "./dto/auth.dto";
import { publicId } from "@smm/utils";
import { LicenseAuthorityService } from "../license-authority/license-authority.service";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private licenseAuthority: any = null;
  private licenseResolved = false;

  constructor(
    @InjectModel("User") private readonly userModel: Model<any>,
    @InjectModel("UserGroup") private readonly userGroupModel: Model<any>,
    @InjectModel("Wallet") private readonly walletModel: Model<any>,
    private readonly jwtService: JwtService,
    private readonly moduleRef: ModuleRef,
    @Optional()
    private readonly licenseAuthorityService?: LicenseAuthorityService,
  ) {}

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

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const username = dto.username.toLowerCase();

    this.logger.log(`registration requested for ${email}`);

    const existing = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });
    if (existing) {
      if (existing.email?.toLowerCase() === email) {
        this.logger.warn(`registration blocked: email already registered ${email}`);
        throw new ConflictException({
          error: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists.",
        });
      }
      this.logger.warn(`registration blocked: username already taken ${username}`);
      throw new ConflictException({
        error: "USERNAME_ALREADY_EXISTS",
        message: "This username is already taken.",
      });
    }

    const defaultGroup = await this.userGroupModel.findOne({ isDefault: true });
    const passwordHash = await hashPassword(dto.password);

    let referredBy;
    if (dto.referralCode) {
      const referrer = await this.userModel.findOne({
        referralCode: dto.referralCode,
      });
      if (referrer) referredBy = referrer._id;
    }

    let user;
    try {
      user = await this.userModel.create({
        email,
        username,
        passwordHash,
        name: dto.name,
        status: "active",
        role: "user",
        userGroupId: defaultGroup?._id,
        referralCode: publicId("REF").replace("REF-", "").slice(0, 8).toUpperCase(),
        flags: { emailVerified: false, twoFactorEnabled: false, apiAccess: true },
        referredBy,
        failedLoginAttempts: 0,
      });
      this.logger.log(`user created ${user._id}`);
    } catch (error: any) {
      if (error?.code === 11000) {
        this.logger.warn(`registration blocked: duplicate key on create for ${email}`);
        throw new ConflictException({
          error: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email or username already exists.",
        });
      }
      this.logger.error(`user creation failed for ${email}`, error);
      throw error;
    }

    try {
      await this.walletModel.create({
        userId: user._id,
        balance: 0,
        pendingBalance: 0,
        currency: "INR",
      });
      this.logger.log(`wallet created for user ${user._id}`);
    } catch (error) {
      this.logger.error(`wallet creation failed for ${user._id}`, error);
      await this.userModel.deleteOne({ _id: user._id }).catch(() => undefined);
      throw error;
    }

    const me = await this.getMe(user._id.toString());
    const tokens = await this.issueTokens(user._id.toString(), user.role, []);
    this.logger.log(`registration complete for ${email}`);
    return { user: me, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account temporarily locked. Try again later.");
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status === "suspended" || user.status === "banned") {
      throw new UnauthorizedException("Account is suspended");
    }

    user.failedLoginAttempts = 0;
    user.lastLoginAt = new Date();
    await user.save();

    return this.issueTokens(user._id.toString(), user.role, user.permissions ?? [], user.tokenVersion);
  }

  async issueTokens(
    userId: string,
    role: string,
    permissions: string[] = [],
    tokenVersion?: number,
  ): Promise<AuthTokens> {
    const secret = process.env.JWT_SECRET ?? "";
    const common = { sub: userId, role, permissions, tv: tokenVersion ?? 0 };
    const accessToken = await signJwt(
      { ...common, type: "access" },
      { secret, expiresIn: process.env.JWT_ACCESS_TTL ?? "1d" },
    );
    const refreshToken = await signJwt(
      { ...common, type: "refresh" },
      { secret, expiresIn: process.env.JWT_REFRESH_TTL ?? "30d" },
    );
    return { accessToken, refreshToken, expiresIn: 86400 };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_SECRET,
      });
      if (payload.type !== "refresh") throw new UnauthorizedException("Invalid token");
      const user = await this.userModel.findById(payload.sub);
      if (!user || user.status === "suspended" || user.status === "banned") {
        throw new UnauthorizedException("Account unavailable");
      }
      if (
        user.tokenVersion != null &&
        payload.tv != null &&
        user.tokenVersion !== payload.tv
      ) {
        throw new UnauthorizedException("Session revoked. Please sign in again.");
      }
      return this.issueTokens(
        user._id.toString(),
        user.role,
        user.permissions ?? [],
        user.tokenVersion,
      );
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  async requestPasswordReset(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) return { ok: true };
    const token = randomSecret(32);
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userModel.findOne({ resetToken: token });
    if (!user || (user.resetTokenExpires && user.resetTokenExpires < new Date())) {
      throw new BadRequestException("Invalid or expired token");
    }
    user.passwordHash = await hashPassword(newPassword);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
    return { ok: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException("Current password is incorrect");
    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    return { ok: true };
  }

  async getMe(userId: string) {
    const userRaw = await this.userModel.findById(userId).lean();
    const user: any = userRaw as any;
    if (!user) throw new UnauthorizedException("User not found");
    const walletRaw = await this.walletModel.findOne({ userId: user._id }).lean();
    const wallet: any = walletRaw as any;

    let adminLicense: any = undefined;
    if (user.role === "admin" || user.role === "super_admin") {
      const authority = this.getLicenseAuthority();
      if (authority) {
        try {
          const access = await authority.resolveAdminAccess(
            String(user._id),
            user.email,
          );
          adminLicense = {
            granted: access?.granted ?? false,
            code: access?.code ?? "LICENSE_NOT_FOUND",
            message: access?.message ?? "No license found.",
            licenseId: access?.licenseId,
            status: access?.status,
            expiresAt: access?.expiresAt,
          };
        } catch {
          adminLicense = { granted: false, code: "LICENSE_CHECK_FAILED", message: "License check failed." };
        }
      }
    }

    return {
      id: String(user._id),
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      permissions: user.permissions ?? [],
      flags: user.flags,
      referralCode: user.referralCode,
      walletBalance: wallet?.balance ?? 0,
      createdAt: user.createdAt,
      adminLicense,
    };
  }
}