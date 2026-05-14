import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { CatalogService } from "../catalog.service";
import { CreateProductDto } from "../dto/create-product.dto";
import { UpdateProductDto } from "../dto/update-product.dto";

@ApiTags("admin products")
@ApiBearerAuth()
@Controller("admin/products")
@UseGuards(JwtAuthGuard)
export class AdminProductController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.catalogService.listProducts(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.catalogService.updateProduct(user.tenantId, id, dto);
  }
}
