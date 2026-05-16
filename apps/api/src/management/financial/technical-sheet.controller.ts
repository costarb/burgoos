import { Body, Controller, Get, Inject, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { ReplaceTechnicalSheetDto } from "./dto/technical-sheet.dto";
import { TechnicalSheetService } from "./technical-sheet.service";

@ApiTags("admin technical sheets")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard)
export class TechnicalSheetController {
  constructor(@Inject(TechnicalSheetService) private readonly service: TechnicalSheetService) {}

  @Get("technical-sheets")
  listSummaries(@CurrentUser() user: AuthUser) {
    return this.service.listSummaries(user.tenantId);
  }

  @Get("products/:productId/technical-sheet")
  get(@CurrentUser() user: AuthUser, @Param("productId") productId: string) {
    return this.service.get(user.tenantId, productId);
  }

  @Put("products/:productId/technical-sheet")
  replace(
    @CurrentUser() user: AuthUser,
    @Param("productId") productId: string,
    @Body() dto: ReplaceTechnicalSheetDto
  ) {
    return this.service.replace(user.tenantId, productId, dto);
  }
}
