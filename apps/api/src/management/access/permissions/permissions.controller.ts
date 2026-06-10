import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { PermissionsService } from "./permissions.service";

@Controller("admin/access/permissions")
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  list() {
    return this.permissions.listGrouped();
  }
}
