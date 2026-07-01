import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { ManagementReportQuery, parseManagementReportQuery } from "./management-report.types";
import { ManagementReportService } from "./management-report.service";

@ApiTags("admin management reports")
@ApiBearerAuth()
@Controller("admin/reports/management")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("finance.view", "finance.manage")
export class ManagementReportController {
  constructor(
    @Inject(ManagementReportService)
    private readonly managementReportService: ManagementReportService
  ) {}

  @Get()
  @ApiOperation({ summary: "Get consolidated management report for a period" })
  @ApiOkResponse({ description: "Consolidated management report." })
  getReport(@CurrentUser() user: AuthUser, @Query() query: ManagementReportQuery) {
    return this.managementReportService.getReport(user.tenantId, parseManagementReportQuery(query));
  }
}
