import { Controller, Get, Headers, Inject, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
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
  @ApiOperation({ summary: "List operational notifications for the authenticated admin user" })
  @ApiOkResponse({ description: "Notification center state with unread count and recent items." })
  list(@CurrentUser() user: AuthUser, @Query() query: NotificationsQueryDto) {
    const normalizedQuery: NotificationsQueryDto = { ...query };
    if (query.limit !== undefined) {
      normalizedQuery.limit = Number(query.limit);
    }

    return this.notificationsService.list(user.tenantId, user.id, normalizedQuery);
  }

  @Get("summary")
  @RequirePermission("finance.view", "finance.manage")
  @ApiOperation({ summary: "Get minimal notification count and version" })
  @ApiOkResponse({ description: "Minimal notification summary with ETag." })
  async summary(
    @CurrentUser() user: AuthUser,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const summary = await this.notificationsService.summary(user.tenantId, user.id);
    response.setHeader("ETag", summary.etag);
    if (ifNoneMatch === summary.etag) {
      response.status(304);
      return;
    }
    return { unreadCount: summary.unreadCount, version: summary.version };
  }

  @Post(":notificationId/read")
  @RequirePermission("finance.view", "finance.manage")
  @ApiOperation({ summary: "Mark an operational notification as read" })
  @ApiParam({ name: "notificationId", description: "Operational notification identifier." })
  @ApiOkResponse({ description: "Notification updated to read status." })
  @ApiNotFoundResponse({ description: "Notification not found for the authenticated user." })
  markRead(@CurrentUser() user: AuthUser, @Param("notificationId") notificationId: string) {
    return this.notificationsService.markRead(user.tenantId, user.id, notificationId);
  }
}
