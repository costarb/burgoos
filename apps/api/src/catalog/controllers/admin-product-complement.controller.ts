import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import {
  CreateProductComplementDto,
  UpdateProductComplementDto,
} from "../dto/product-complement.dto";
import { ProductComplementService } from "../product-complement.service";

@ApiTags("admin product complements")
@ApiBearerAuth()
@Controller("admin/product-complements")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("catalog.manage")
export class AdminProductComplementController {
  constructor(
    @Inject(ProductComplementService)
    private readonly complements: ProductComplementService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.complements.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductComplementDto) {
    return this.complements.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateProductComplementDto,
  ) {
    return this.complements.update(user.tenantId, id, dto);
  }
}
