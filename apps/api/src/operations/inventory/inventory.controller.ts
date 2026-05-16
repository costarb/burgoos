import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { StockMovementDto } from "./dto/stock-movement.dto";
import { InventoryService } from "./inventory.service";

@ApiTags("admin inventory")
@ApiBearerAuth()
@Controller("admin/inventory")
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly service: InventoryService) {}

  @Get("balances")
  listBalances(@CurrentUser() user: AuthUser) {
    return this.service.listBalances(user.tenantId);
  }

  @Post("movements")
  createManualMovement(@CurrentUser() user: AuthUser, @Body() dto: StockMovementDto) {
    return this.service.createManualMovement(user.tenantId, dto);
  }
}
