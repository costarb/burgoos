import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { DeliveryProvider } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { CatalogService } from "../catalog.service";
import { CreateProductDto } from "../dto/create-product.dto";
import { UpdateProductDto } from "../dto/update-product.dto";

@ApiTags("admin products")
@ApiBearerAuth()
@Controller("admin/products")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("catalog.manage")
export class AdminProductController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query()
    query: {
      search?: string;
      categoryId?: string;
      active?: string;
      provider?: DeliveryProvider;
    }
  ) {
    return this.catalogService.listProducts(user.tenantId, {
      search: query.search?.trim() || undefined,
      categoryId: query.categoryId || undefined,
      active: parseBooleanQuery(query.active),
      provider: parseProviderQuery(query.provider),
    });
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

function parseProviderQuery(value?: string): DeliveryProvider | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(DeliveryProvider).includes(value as DeliveryProvider)
    ? (value as DeliveryProvider)
    : undefined;
}

function parseBooleanQuery(value?: string): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}
