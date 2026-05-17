import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { MenuEngineeringService } from "./menu-engineering.service";

@ApiTags("admin menu engineering")
@ApiBearerAuth()
@Controller("admin/reports/menu-engineering")
@UseGuards(JwtAuthGuard)
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
    const periodStart = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : firstDayOfCurrentMonth();
    const periodEnd = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : lastDayOfCurrentMonth();

    return this.menuEngineeringService.getReport(user.tenantId, periodStart, periodEnd);
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
