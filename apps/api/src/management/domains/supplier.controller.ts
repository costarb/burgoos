import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { SupplierDto } from "./dto/supplier.dto";
import { SupplierService } from "./supplier.service";

@ApiTags("admin suppliers")
@ApiBearerAuth()
@Controller("admin/suppliers")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("catalog.manage", "finance.manage")
export class SupplierController {
  constructor(@Inject(SupplierService) private readonly service: SupplierService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: SupplierDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SupplierDto) {
    return this.service.update(user.tenantId, id, dto);
  }
}
