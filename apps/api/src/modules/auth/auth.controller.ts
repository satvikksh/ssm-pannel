import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public, CurrentUser, LicenseExempt } from "../../common/decorators";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RegisterDto, LoginDto, RefreshDto, ResetPasswordDto, ChangePasswordDto } from "./dto/auth.dto";
import { ok } from "../../common/utils/response";
import { Request } from "express";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return ok(user);
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login(dto);
    return ok(tokens);
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.authService.refreshToken(dto.refreshToken);
    return ok(tokens);
  }

  @Public()
  @Post("forgot-password")
  async forgotPassword(@Body() dto: { email: string }) {
    if (!dto?.email) throw new BadRequestException("Email is required");
    const result = await this.authService.requestPasswordReset(dto.email);
    return ok(result);
  }

  @Public()
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(dto.token, dto.newPassword);
    return ok(result);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  async changePassword(@CurrentUser() user: { id: string }, @Body() dto: ChangePasswordDto) {
    const result = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return ok(result);
  }

  @UseGuards(JwtAuthGuard)
  @LicenseExempt()
  @Get("me")
  async me(@CurrentUser() user: { id: string }) {
    const me = await this.authService.getMe(user.id);
    return ok(me);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Req() _req: Request) {
    return ok({ ok: true });
  }
}