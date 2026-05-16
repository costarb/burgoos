import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { PurchaseUnitDto } from "./dto/purchase-unit.dto";
import { PurchaseUnitService } from "./purchase-unit.service";

@ApiTags("admin purchase units")
@ApiBearerAuth()
@Controller("admin/purchase-units")
@UseGuards(JwtAuthGuard)
export class PurchaseUnitController {
  constructor(@Inject(PurchaseUnitService) private readonly service: PurchaseUnitService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: PurchaseUnitDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PurchaseUnitDto) {
    return this.service.update(user.tenantId, id, dto);
  }
}
