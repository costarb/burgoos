import { Body, Controller, Get, Inject, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformAdminGuard, PlatformAuthUser } from "../auth/platform-admin.guard";
import { BlingPlatformConfigurationService } from "./bling-platform-configuration.service";
import { UpdateBlingPlatformConfigurationDto } from "./dto/bling-platform-configuration.dto";

@ApiTags("platform integrations")
@ApiBearerAuth()
@Controller("platform/integrations/bling/configuration")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class BlingPlatformConfigurationController {
  constructor(
    @Inject(BlingPlatformConfigurationService) private readonly service: BlingPlatformConfigurationService
  ) {}

  /** Includes the exact redirect URL to register in the Bling app, derived from this API host. */
  @Get()
  get(@Req() request: Request) {
    return this.service.safeView(publicBaseUrl(request));
  }

  @Put()
  update(@CurrentUser() user: PlatformAuthUser, @Body() dto: UpdateBlingPlatformConfigurationDto, @Req() request: Request) {
    return this.service.update(dto, user.id, publicBaseUrl(request));
  }
}

function publicBaseUrl(request: Request): string {
  const forwardedProto = String(request.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
  const forwardedHost = String(request.headers["x-forwarded-host"] ?? "").split(",")[0]?.trim();
  return `${forwardedProto || request.protocol}://${forwardedHost || request.get("host")}`;
}
