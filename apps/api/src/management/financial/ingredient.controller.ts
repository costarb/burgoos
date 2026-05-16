import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { IngredientDto } from "./dto/ingredient.dto";
import { IngredientService } from "./ingredient.service";

@ApiTags("admin ingredients")
@ApiBearerAuth()
@Controller("admin/ingredients")
@UseGuards(JwtAuthGuard)
export class IngredientController {
  constructor(@Inject(IngredientService) private readonly service: IngredientService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: IngredientDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: IngredientDto) {
    return this.service.update(user.tenantId, id, dto);
  }
}
