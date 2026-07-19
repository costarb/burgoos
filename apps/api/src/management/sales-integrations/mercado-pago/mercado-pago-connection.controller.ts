import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import {
  MercadoPagoCredentialModeDto,
  StartMercadoPagoOAuthDto,
} from "../dto/sales-integration.dto";
import { MercadoPagoConnectionService } from "./mercado-pago-connection.service";

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("integrations.sales.manage")
@Controller("admin/sales-integrations/:integrationId/mercado-pago")
@ApiTags("Mercado Pago connection")
@ApiBearerAuth()
export class MercadoPagoConnectionController {
  constructor(
    @Inject(MercadoPagoConnectionService) private readonly service: MercadoPagoConnectionService
  ) {}

  @Post("oauth/connect")
  @ApiOperation({ summary: "Start Mercado Pago OAuth with state and PKCE" })
  connect(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Body() dto: StartMercadoPagoOAuthDto
  ) {
    return this.service.startOAuth({
      tenantId: user.tenantId,
      integrationId,
      userId: user.id,
      initialLoadDays: dto.initialLoadDays,
    });
  }

  @Post("fixed-token")
  @ApiOperation({
    summary: "Validate and store a write-only Mercado Pago access token for testing",
  })
  fixed(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Body() dto: MercadoPagoCredentialModeDto
  ) {
    if (dto.mode !== "FIXED_TOKEN" || !dto.accessToken)
      throw new BadRequestException("Access token obrigatorio");
    return this.service.connectFixedToken({
      tenantId: user.tenantId,
      integrationId,
      userId: user.id,
      accessToken: dto.accessToken,
    });
  }

  @Delete()
  disconnect(@CurrentUser() user: AuthUser, @Param("integrationId") integrationId: string) {
    return this.service.disconnect(user.tenantId, integrationId, user.id);
  }
}
