import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { PermissionsService } from "./permissions.service";

@Controller("admin/access/permissions")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("access.users.manage", "access.profiles.manage")
export class PermissionsController {
  constructor(@Inject(PermissionsService) private readonly permissions: PermissionsService) {}

  @Get()
  list() {
    return this.permissions.listGrouped();
  }
}
