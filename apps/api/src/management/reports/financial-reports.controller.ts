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
    const periodStart = start ? localDayStart(start) : firstDayOfCurrentMonth();
    const periodEnd = end ? localDayEnd(end) : lastDayOfCurrentMonth();

    return this.dreService.getSummary(user.tenantId, periodStart, periodEnd);
  }

  @Get("dashboard")
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getIndicators(user.tenantId);
  }
}

function firstDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function lastDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function localDayStart(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function localDayEnd(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}
