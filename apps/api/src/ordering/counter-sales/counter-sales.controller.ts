import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { CounterCatalogService } from "./counter-catalog.service";
import { CounterOrderService } from "./counter-order.service";
import {
  CreateCounterOrderDto,
  UpdateCounterOrderDto,
} from "./dto/create-counter-order.dto";

@ApiTags("admin pos")
@ApiBearerAuth()
@Controller("admin/pos")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("pos.capture")
export class CounterSalesController {
  constructor(
    @Inject(CounterCatalogService) private readonly catalog: CounterCatalogService,
    @Inject(CounterOrderService) private readonly orders: CounterOrderService,
  ) {}

  @Get("catalog")
  @ApiOperation({ summary: "Listar catálogo operacional do POS" })
  @ApiResponse({ status: 200, description: "Catálogo ativo da loja autenticada." })
  getCatalog(@CurrentUser() user: AuthUser) {
    return this.catalog.getCatalog(user.tenantId);
  }

  @Post("orders")
  @ApiOperation({ summary: "Criar pedido de balcão idempotente" })
  @ApiResponse({ status: 201, description: "Pedido criado e opcionalmente enviado ao KDS." })
  @ApiResponse({ status: 409, description: "Conflito de comanda, preço ou idempotência." })
  @UseInterceptors(IdempotencyInterceptor)
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateCounterOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get("orders/pending-payment")
  @ApiOperation({ summary: "Listar pedidos avulsos aguardando pagamento" })
  getPendingPayment(@CurrentUser() user: AuthUser) {
    return this.orders.pendingPayment(user.tenantId);
  }

  @Get("orders/:orderId")
  @ApiOperation({ summary: "Consultar pedido capturado no POS" })
  @ApiParam({ name: "orderId", format: "uuid" })
  getOrder(@CurrentUser() user: AuthUser, @Param("orderId") orderId: string) {
    return this.orders.findOne(user, orderId);
  }

  @Patch("orders/:orderId")
  @ApiOperation({ summary: "Alterar pedido capturado no POS" })
  @ApiParam({ name: "orderId", format: "uuid" })
  updateOrder(
    @CurrentUser() user: AuthUser,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateCounterOrderDto,
  ) {
    return this.orders.update(user, orderId, dto);
  }
}
