import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../platform/auth/jwt-auth.guard";
import { AuthUser } from "../platform/auth/auth.types";
import { ReportsService } from "./reports.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/reports")
export class DailySummaryController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get("daily-summary")
  getDailySummary(@CurrentUser() user: AuthUser, @Query("date") date?: string) {
    return this.reportsService.getDailySummary(user.tenantId, date);
  }
}
