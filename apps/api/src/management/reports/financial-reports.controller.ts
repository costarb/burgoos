import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { DreService } from "./dre.service";
import { FinancialDashboardService } from "./financial-dashboard.service";
import { competenceFromDate } from "./dre-competence";

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
    @Query("competence") competence?: string,
    @Query("start") start?: string
  ) {
    return this.dreService.getMonthlySummary(user.tenantId, competence || competenceFromDate(start));
  }

  @Get("dashboard")
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getIndicators(user.tenantId);
  }
}
