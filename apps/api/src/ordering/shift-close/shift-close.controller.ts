import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { ShiftCloseService } from "./shift-close.service";

@ApiTags("tabs")
@ApiBearerAuth()
@Controller("admin/shift-close")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShiftCloseController {
  constructor(private readonly shifts: ShiftCloseService) {}

  @Get("summary")
  @ApiOperation({ summary: "Resumir pendências operacionais antes do fechamento do turno" })
  @RequirePermission("tabs.manage")
  summary(@CurrentUser() user: AuthUser) {
    return this.shifts.summary(user.tenantId);
  }
}
