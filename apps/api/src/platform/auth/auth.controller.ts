import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
} from "../../auth/dto/password-reset.dto";
import { RefreshTokenDto } from "../../auth/dto/login.dto";
import { AuthService, LoginResult } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @Post("platform/login")
  async loginPlatform(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.loginPlatform(dto);
  }

  @Post("refresh")
  async refresh(@Body() dto: RefreshTokenDto): Promise<LoginResult> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Post("password-reset/request")
  @HttpCode(202)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto.login);
  }

  @Post("password-reset/confirm")
  @HttpCode(204)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }
}
