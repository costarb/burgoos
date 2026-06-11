import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { StockMovementDto } from "./dto/stock-movement.dto";
import { InventoryService } from "./inventory.service";

@ApiTags("admin inventory")
@ApiBearerAuth()
@Controller("admin/inventory")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly service: InventoryService) {}

  @Get("balances")
  @RequirePermission("orders.view", "catalog.manage")
  listBalances(@CurrentUser() user: AuthUser) {
    return this.service.listBalances(user.tenantId);
  }

  @Post("movements")
  @RequirePermission("catalog.manage")
  createManualMovement(@CurrentUser() user: AuthUser, @Body() dto: StockMovementDto) {
    return this.service.createManualMovement(user.tenantId, dto);
  }
}
