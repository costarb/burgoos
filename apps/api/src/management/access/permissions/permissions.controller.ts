import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { PermissionsService } from "./permissions.service";

@Controller("admin/access/permissions")
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(@Inject(PermissionsService) private readonly permissions: PermissionsService) {}

  @Get()
  list() {
    return this.permissions.listGrouped();
  }
}
