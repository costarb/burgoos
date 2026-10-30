import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Put, Query, Redirect, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsObject, IsString, Matches } from "class-validator";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../../platform/auth/auth.types";
import { CurrentUser } from "../../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../../platform/auth/jwt-auth.guard";
import { BlingPlatformConfigurationService } from "../../../../platform/integrations/bling-platform-configuration.service";
import { FISCAL_PERMISSIONS } from "../../fiscal-permissions";
import { BlingConnectionService } from "./bling-connection.service";
import { BlingOAuthService } from "./bling-oauth.service";

export class BlingSettingsDto {
  @IsString()
  @Matches(/^\d{1,20}$/)
  naturezaOperacaoId!: string;

  @IsObject()
  @Type(() => Object)
  paymentMethodMap!: Record<string, string>;
}

const DEFAULT_POST_CALLBACK = "http://localhost:3000/admin/fiscal";

/** Public OAuth callback registered in the Bling app: GET /api/integrations/bling/callback. */
@Controller("integrations/bling")
@ApiTags("Bling OAuth callback")
export class BlingOAuthCallbackController {
  constructor(
    @Inject(BlingOAuthService) private readonly oauth: BlingOAuthService,
    @Inject(BlingPlatformConfigurationService) private readonly platform: BlingPlatformConfigurationService
  ) {}

  @Get("callback")
  @Redirect()
  @ApiOperation({ summary: "Consume the one-time Bling OAuth callback" })
  async callback(@Query("code") code?: string, @Query("state") state?: string, @Query("error") error?: string) {
    const target = new URL((await this.platform.value("postCallbackUrl")) ?? DEFAULT_POST_CALLBACK);
    if (error || !code || !state) {
      target.searchParams.set("bling", "error");
      target.searchParams.set("reason", error ? "denied" : "invalid_callback");
      return { url: target.toString(), statusCode: 302 };
    }
    try {
      await this.oauth.complete(code, state);
      target.searchParams.set("bling", "connected");
    } catch {
      target.searchParams.set("bling", "error");
      target.searchParams.set("reason", "authorization_failed");
    }
    return { url: target.toString(), statusCode: 302 };
  }
}

@ApiTags("admin fiscal")
@ApiBearerAuth()
@Controller("admin/fiscal/connections/bling")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(FISCAL_PERMISSIONS.configure)
export class BlingConnectionController {
  constructor(
    @Inject(BlingOAuthService) private readonly oauth: BlingOAuthService,
    @Inject(BlingConnectionService) private readonly connection: BlingConnectionService
  ) {}

  @Get("options")
  options(@CurrentUser() user: AuthUser) {
    return this.connection.options(user.tenantId);
  }

  @Put("settings")
  settings(@CurrentUser() user: AuthUser, @Body() dto: BlingSettingsDto) {
    return this.connection.updateSettings(user, dto);
  }

  @Post("authorize")
  @HttpCode(200)
  authorize(@CurrentUser() user: AuthUser) {
    return this.oauth.start(user);
  }

  @Delete()
  @HttpCode(204)
  async disconnect(@CurrentUser() user: AuthUser) {
    await this.oauth.disconnect(user);
  }
}
