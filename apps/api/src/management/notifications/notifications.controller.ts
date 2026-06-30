import { Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { FinancialManagementRolesGuard } from "../../platform/auth/roles.guard";
import { NotificationsQueryDto } from "./dto/notification.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("admin notifications")
@ApiBearerAuth()
@Controller("admin/notifications")
@UseGuards(JwtAuthGuard, FinancialManagementRolesGuard, PermissionGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  @Get()
  @RequirePermission("finance.view", "finance.manage")
  list(@CurrentUser() user: AuthUser, @Query() query: NotificationsQueryDto) {
    return this.notificationsService.list(user.tenantId, user.id, query);
  }

  @Post(":notificationId/read")
  @RequirePermission("finance.view", "finance.manage")
  markRead(@CurrentUser() user: AuthUser, @Param("notificationId") notificationId: string) {
    return this.notificationsService.markRead(user.tenantId, user.id, notificationId);
  }
}
