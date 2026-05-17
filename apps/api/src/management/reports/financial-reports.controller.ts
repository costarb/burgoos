import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { DreService } from "./dre.service";
import { FinancialDashboardService } from "./financial-dashboard.service";

@ApiTags("admin financial reports")
@ApiBearerAuth()
@Controller("admin/reports/financial")
@UseGuards(JwtAuthGuard)
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
    const periodStart = start ? new Date(`${start}T00:00:00.000Z`) : firstDayOfCurrentMonth();
    const periodEnd = end ? new Date(`${end}T23:59:59.999Z`) : lastDayOfCurrentMonth();

    return this.dreService.getSummary(user.tenantId, periodStart, periodEnd);
  }

  @Get("dashboard")
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getIndicators(user.tenantId);
  }
}

function firstDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function lastDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}
