import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { DreService } from "./dre.service";
import { FinancialDashboardService } from "./financial-dashboard.service";
import { currentMonthEnd, currentMonthStart, dayEnd, dayStart } from "../../common/reporting/report-period";

@ApiTags("admin financial reports")
@ApiBearerAuth()
@Controller("admin/reports/financial")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("finance.view", "finance.manage")
export class FinancialReportsController {
  constructor(
    @Inject(DreService) private readonly dreService: DreService,
    @Inject(FinancialDashboardService) private readonly dashboardService: FinancialDashboardService
  ) {}

  @Get("dre")
  getDre(
    @CurrentUser() user: AuthUser,
    @Query("start") start?: string,
    @Query("end") end?: string
  ) {
    const periodStart = start ? dayStart(start) : currentMonthStart();
    const periodEnd = end ? dayEnd(end) : currentMonthEnd();

    return this.dreService.getSummary(user.tenantId, periodStart, periodEnd);
  }

  @Get("dashboard")
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getIndicators(user.tenantId);
  }
}
