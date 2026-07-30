import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import {
  ClaimOperationalAssignmentDto,
  TransferOperationalAssignmentDto,
} from "./dto/operational-assignment.dto";
import { OperationalAssignmentService } from "./operational-assignment.service";

@ApiTags("admin operational assignments")
@ApiBearerAuth()
@Controller("admin/operational-assignments")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OperationalAssignmentController {
  constructor(private readonly assignments: OperationalAssignmentService) {}

  @Get("assignees")
  @RequirePermission("kds.view", "kds.manage", "tabs.view", "tabs.manage")
  listAssignees(@CurrentUser() user: AuthUser) {
    return this.assignments.listAssignees(user);
  }

  @Post("orders/:orderId/claim")
  @RequirePermission("kds.manage")
  claimOrder(@CurrentUser() user: AuthUser, @Param("orderId") id: string, @Body() dto: ClaimOperationalAssignmentDto) {
    return this.assignments.claimOrder(user, id, dto);
  }

  @Post("orders/:orderId/transfer")
  @RequirePermission("kds.manage")
  transferOrder(@CurrentUser() user: AuthUser, @Param("orderId") id: string, @Body() dto: TransferOperationalAssignmentDto) {
    return this.assignments.transferOrder(user, id, dto);
  }

  @Post("tabs/:tabId/claim")
  @RequirePermission("tabs.manage")
  claimTab(@CurrentUser() user: AuthUser, @Param("tabId") id: string, @Body() dto: ClaimOperationalAssignmentDto) {
    return this.assignments.claimTab(user, id, dto);
  }

  @Post("tabs/:tabId/transfer")
  @RequirePermission("tabs.manage")
  transferTab(@CurrentUser() user: AuthUser, @Param("tabId") id: string, @Body() dto: TransferOperationalAssignmentDto) {
    return this.assignments.transferTab(user, id, dto);
  }
}
