import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../platform/auth/jwt-auth.guard";
import { OrderMaintenanceRolesGuard } from "../platform/auth/roles.guard";
import { AuthUser } from "../platform/auth/auth.types";
import { ImportOrdersDto } from "./dto/import-orders.dto";
import { HistoricalOrderImportService } from "./historical-order-import.service";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrderingService } from "./ordering.service";
import { DeleteOrderDto } from "./dto/delete-order.dto";
import { EditOrderDto } from "./dto/edit-order.dto";
import { OrderMaintenanceQueryDto } from "./dto/order-maintenance-query.dto";
import { OrderMaintenanceService } from "./order-maintenance.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/orders")
export class AdminOrderController {
  constructor(
    @Inject(OrderingService) private readonly orderingService: OrderingService,
    @Inject(HistoricalOrderImportService)
    private readonly historicalOrderImportService: HistoricalOrderImportService,
    @Inject(OrderMaintenanceService) private readonly orderMaintenanceService: OrderMaintenanceService
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

  @Get("maintenance")
  @UseGuards(OrderMaintenanceRolesGuard)
  searchMaintenance(@CurrentUser() user: AuthUser, @Query() query: OrderMaintenanceQueryDto) {
    return this.orderMaintenanceService.search(user.tenantId, query);
  }

  @Get(":id/maintenance-history")
  @UseGuards(OrderMaintenanceRolesGuard)
  maintenanceHistory(@CurrentUser() user: AuthUser, @Param("id") orderId: string) {
    return this.orderMaintenanceService.history(user.tenantId, orderId);
  }

  @Patch(":id/maintenance")
  @UseGuards(OrderMaintenanceRolesGuard)
  editOrder(
    @CurrentUser() user: AuthUser,
    @Param("id") orderId: string,
    @Body() dto: EditOrderDto
  ) {
    return this.orderMaintenanceService.edit(user, orderId, dto);
  }

  @Delete(":id/maintenance")
  @UseGuards(OrderMaintenanceRolesGuard)
  deleteOrder(
    @CurrentUser() user: AuthUser,
    @Param("id") orderId: string,
    @Body() dto: DeleteOrderDto
  ) {
    return this.orderMaintenanceService.remove(user, orderId, dto);
  }
}
