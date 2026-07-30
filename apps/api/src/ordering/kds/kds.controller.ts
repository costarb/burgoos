import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { KdsCommandService } from "./kds-command.service";
import { KdsQueryService } from "./kds-query.service";
import { UpdateKdsOrderStatusDto } from "./dto/update-kds-order-status.dto";

@ApiTags("admin kds")
@ApiBearerAuth()
@Controller("admin/kds/orders")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class KdsController {
  constructor(
    private readonly query: KdsQueryService,
    private readonly command: KdsCommandService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Obter fila operacional ativa do KDS" })
  @ApiResponse({ status: 200, description: "Pedidos ordenados por prioridade operacional." })
  @RequirePermission("kds.view", "kds.manage")
  snapshot(@CurrentUser() user: AuthUser) {
    return this.query.snapshot(user.tenantId);
  }

  @Patch(":orderId/status")
  @ApiOperation({ summary: "Aplicar transição de produção no KDS" })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiResponse({ status: 409, description: "Versão ou transição de status inválida." })
  @RequirePermission("kds.manage")
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateKdsOrderStatusDto,
  ) {
    return this.command.updateStatus(user, orderId, dto);
  }
}
