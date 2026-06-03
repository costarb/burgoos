import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { SalesReportService } from "./sales-report.service";
import { parseSalesReportQuery, SalesReportQuery } from "./sales-report.types";

@ApiTags("admin sales reports")
@ApiBearerAuth()
@Controller("admin/reports/sales")
@UseGuards(JwtAuthGuard)
export class SalesReportController {
  constructor(@Inject(SalesReportService) private readonly salesReportService: SalesReportService) {}

  @Get()
  getReport(@CurrentUser() user: AuthUser, @Query() query: SalesReportQuery) {
    return this.salesReportService.getReport(user.tenantId, parseSalesReportQuery(query));
  }
}
