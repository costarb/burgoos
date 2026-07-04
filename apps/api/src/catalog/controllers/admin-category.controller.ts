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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { CatalogService } from "../catalog.service";
import { CreateCategoryDto } from "../dto/create-category.dto";
import { UpdateCategoryDto } from "../dto/update-category.dto";

@ApiTags("admin categories")
@ApiBearerAuth()
@Controller("admin/categories")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("catalog.manage")
export class AdminCategoryController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: { search?: string; active?: string }) {
    return this.catalogService.listCategories(user.tenantId, {
      search: query.search?.trim() || undefined,
      active: parseBooleanQuery(query.active),
    });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalogService.updateCategory(user.tenantId, id, dto);
  }

  @Delete(":id")
  delete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.catalogService.deleteCategory(user.tenantId, id);
  }
}

function parseBooleanQuery(value?: string): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value === "true";
}
