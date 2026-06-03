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
    const periodStart = dateFrom ? localDayStart(dateFrom) : firstDayOfCurrentMonth();
    const periodEnd = dateTo ? localDayEnd(dateTo) : lastDayOfCurrentMonth();

    return this.menuEngineeringService.getReport(user.tenantId, periodStart, periodEnd);
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
