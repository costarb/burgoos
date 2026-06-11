import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { FinancialConfigurationService } from "./financial-configuration.service";
import { UpdateFinancialConfigurationDto } from "./dto/update-financial-configuration.dto";

@ApiTags("admin financial")
@ApiBearerAuth()
@Controller("admin/financial/config")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FinancialConfigurationController {
  constructor(
    @Inject(FinancialConfigurationService) private readonly service: FinancialConfigurationService
  ) {}

  @Get()
  @RequirePermission("finance.view", "finance.manage")
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.tenantId);
  }

  @Put()
  @RequirePermission("finance.manage")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateFinancialConfigurationDto) {
    return this.service.update(user.tenantId, dto);
  }
}
