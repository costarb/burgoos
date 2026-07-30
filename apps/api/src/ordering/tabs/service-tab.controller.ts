import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ServiceTabStatus } from "@prisma/client";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import {
  CancelServiceTabDto,
  CheckoutServiceTabDto,
  OpenServiceTabDto,
  ReopenServiceTabDto,
  UpdateServiceTabDto,
} from "./dto/service-tab.dto";
import { ServiceTabService } from "./service-tab.service";

@ApiTags("admin service tabs")
@ApiBearerAuth()
@Controller("admin/tabs")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("tabs.manage")
export class ServiceTabController {
  constructor(@Inject(ServiceTabService) private readonly tabs: ServiceTabService) {}

  @Get()
  @ApiOperation({ summary: "Listar comandas da loja" })
  @ApiQuery({ name: "status", required: false, enum: ServiceTabStatus })
  list(@CurrentUser() user: AuthUser, @Query("status") status?: ServiceTabStatus) {
    const valid = status && Object.values(ServiceTabStatus).includes(status) ? status : undefined;
    return this.tabs.list(user.tenantId, valid);
  }

  @Get(":tabId")
  @ApiOperation({ summary: "Consultar comanda, pedidos e saldo derivado" })
  @ApiParam({ name: "tabId", format: "uuid" })
  detail(@CurrentUser() user: AuthUser, @Param("tabId") tabId: string) {
    return this.tabs.detail(user.tenantId, tabId);
  }

  @Post()
  @ApiOperation({ summary: "Abrir comanda idempotente" })
  @ApiResponse({ status: 409, description: "Número de comanda em uso." })
  @UseInterceptors(IdempotencyInterceptor)
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenServiceTabDto) {
    return this.tabs.open(user, dto);
  }

  @Patch(":tabId")
  @ApiOperation({ summary: "Atualizar identificação da comanda" })
  @ApiParam({ name: "tabId", format: "uuid" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("tabId") tabId: string,
    @Body() dto: UpdateServiceTabDto,
  ) {
    return this.tabs.update(user, tabId, dto);
  }

  @Post(":tabId/checkout")
  @ApiOperation({ summary: "Bloquear comanda para pagamento" })
  @ApiParam({ name: "tabId", format: "uuid" })
  checkout(
    @CurrentUser() user: AuthUser,
    @Param("tabId") tabId: string,
    @Body() dto: CheckoutServiceTabDto,
  ) {
    return this.tabs.startCheckout(user, tabId, dto);
  }

  @Post(":tabId/reopen")
  @ApiOperation({ summary: "Reabrir comanda em fechamento mediante justificativa" })
  @ApiParam({ name: "tabId", format: "uuid" })
  reopen(
    @CurrentUser() user: AuthUser,
    @Param("tabId") tabId: string,
    @Body() dto: ReopenServiceTabDto,
  ) {
    return this.tabs.reopen(user, tabId, dto);
  }

  @Post(":tabId/cancel")
  @ApiOperation({ summary: "Cancelar comanda mediante justificativa" })
  @ApiParam({ name: "tabId", format: "uuid" })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("tabId") tabId: string,
    @Body() dto: CancelServiceTabDto,
  ) {
    return this.tabs.cancel(user, tabId, dto);
  }
}
