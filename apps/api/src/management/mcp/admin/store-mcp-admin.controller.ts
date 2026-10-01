import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { CreateMcpTokenDto, UpdateMcpConfigurationDto } from "./dto/store-mcp.dto";
import { resolveMcpServerUrl } from "./mcp-server-url";
import { StoreMcpConfigurationService } from "./store-mcp-configuration.service";
import { StoreMcpTokenService } from "./store-mcp-token.service";

@ApiTags("admin mcp")
@ApiBearerAuth()
@Controller("admin/mcp")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("mcp.manage")
export class StoreMcpAdminController {
  constructor(
    @Inject(StoreMcpConfigurationService)
    private readonly configurationService: StoreMcpConfigurationService,
    @Inject(StoreMcpTokenService) private readonly tokenService: StoreMcpTokenService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  @Get("configuration")
  getConfiguration(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.configurationService.get(user.tenantId, this.serverUrl(request));
  }

  @Put("configuration")
  updateConfiguration(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMcpConfigurationDto,
    @Req() request: Request
  ) {
    return this.configurationService.update(user, dto, this.serverUrl(request));
  }

  @Get("tokens")
  listTokens(@CurrentUser() user: AuthUser) {
    return this.tokenService.list(user.tenantId);
  }

  @Post("tokens")
  createToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMcpTokenDto,
    @Req() request: Request
  ) {
    return this.tokenService.create(user, dto, this.serverUrl(request));
  }

  @Post("tokens/:id/revoke")
  @HttpCode(200)
  revokeToken(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.tokenService.revoke(user, id);
  }

  private serverUrl(request: Request): string {
    return resolveMcpServerUrl(this.config.get<string>("MCP_PUBLIC_URL"), request);
  }
}
