import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { MenuEngineeringService } from "./menu-engineering.service";
import { currentMonthEnd, currentMonthStart, dayEnd, dayStart } from "../../common/reporting/report-period";

@ApiTags("admin menu engineering")
@ApiBearerAuth()
@Controller("admin/reports/menu-engineering")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("finance.view", "finance.manage")
export class MenuEngineeringController {
  constructor(
    @Inject(MenuEngineeringService)
    private readonly menuEngineeringService: MenuEngineeringService
  ) {}

  @Get()
  getReport(
    @CurrentUser() user: AuthUser,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string
  ) {
    const periodStart = dateFrom ? dayStart(dateFrom) : currentMonthStart();
    const periodEnd = dateTo ? dayEnd(dateTo) : currentMonthEnd();

    return this.menuEngineeringService.getReport(user.tenantId, periodStart, periodEnd);
  }
}
