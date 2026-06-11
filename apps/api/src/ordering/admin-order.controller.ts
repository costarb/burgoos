import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { RequirePermission } from "../auth/guards/require-permission.decorator";
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

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("admin/orders")
export class AdminOrderController {
  constructor(
    @Inject(OrderingService) private readonly orderingService: OrderingService,
    @Inject(HistoricalOrderImportService)
    private readonly historicalOrderImportService: HistoricalOrderImportService,
    @Inject(OrderMaintenanceService)
    private readonly orderMaintenanceService: OrderMaintenanceService
  ) {}

  @Get()
  @RequirePermission("orders.view", "orders.manage")
  list(@CurrentUser() user: AuthUser, @Query("history") history?: string) {
    return this.orderingService.listAdminOrders(user.tenantId, history === "true");
  }

  @Patch(":id/status")
  @RequirePermission("orders.manage")
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") orderId: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.orderingService.updateOrderStatus(user.tenantId, orderId, dto.status);
  }

  @Post("import")
  @RequirePermission("orders.manage")
  importOrders(@CurrentUser() user: AuthUser, @Body() dto: ImportOrdersDto) {
    return this.historicalOrderImportService.importFromCsv(user.tenantId, dto);
  }

  @Get("maintenance")
  @UseGuards(OrderMaintenanceRolesGuard)
  @RequirePermission("orders.manage")
  searchMaintenance(@CurrentUser() user: AuthUser, @Query() query: OrderMaintenanceQueryDto) {
    return this.orderMaintenanceService.search(user.tenantId, query);
  }

  @Get(":id/maintenance-history")
  @UseGuards(OrderMaintenanceRolesGuard)
  @RequirePermission("orders.manage")
  maintenanceHistory(@CurrentUser() user: AuthUser, @Param("id") orderId: string) {
    return this.orderMaintenanceService.history(user.tenantId, orderId);
  }

  @Patch(":id/maintenance")
  @UseGuards(OrderMaintenanceRolesGuard)
  @RequirePermission("orders.manage")
  editOrder(
    @CurrentUser() user: AuthUser,
    @Param("id") orderId: string,
    @Body() dto: EditOrderDto
  ) {
    return this.orderMaintenanceService.edit(user, orderId, dto);
  }

  @Delete(":id/maintenance")
  @UseGuards(OrderMaintenanceRolesGuard)
  @RequirePermission("orders.manage")
  deleteOrder(
    @CurrentUser() user: AuthUser,
    @Param("id") orderId: string,
    @Body() dto: DeleteOrderDto
  ) {
    return this.orderMaintenanceService.remove(user, orderId, dto);
  }
}
