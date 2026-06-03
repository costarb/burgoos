import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../platform/auth/jwt-auth.guard";
import { AuthUser } from "../platform/auth/auth.types";
import { ImportOrdersDto } from "./dto/import-orders.dto";
import { HistoricalOrderImportService } from "./historical-order-import.service";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrderingService } from "./ordering.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/orders")
export class AdminOrderController {
  constructor(
    @Inject(OrderingService) private readonly orderingService: OrderingService,
    @Inject(HistoricalOrderImportService)
    private readonly historicalOrderImportService: HistoricalOrderImportService
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("history") history?: string) {
    return this.orderingService.listAdminOrders(user.tenantId, history === "true");
  }

  @Patch(":id/status")
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") orderId: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.orderingService.updateOrderStatus(user.tenantId, orderId, dto.status);
  }

  @Post("import")
  importOrders(@CurrentUser() user: AuthUser, @Body() dto: ImportOrdersDto) {
    return this.historicalOrderImportService.importFromCsv(user.tenantId, dto);
  }
}
