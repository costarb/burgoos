import { Controller, Get, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { LegacyImageMigrationService } from "../legacy-image-migration.service";

/** Migration of the legacy base64 images of the store to the bucket (spec 030, US4). */
@ApiTags("admin assets")
@ApiBearerAuth()
@Controller("admin/assets/legacy-images")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("catalog.manage")
export class AdminLegacyImageController {
  constructor(@Inject(LegacyImageMigrationService) private readonly migration: LegacyImageMigrationService) {}

  @Post("migrate")
  @HttpCode(202)
  migrate(@CurrentUser() user: AuthUser) {
    return this.migration.request(user.tenantId);
  }

  @Get("migrate")
  status(@CurrentUser() user: AuthUser) {
    return this.migration.status(user.tenantId);
  }
}
