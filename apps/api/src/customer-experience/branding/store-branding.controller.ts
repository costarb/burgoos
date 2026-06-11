import { Body, Controller, Get, Inject, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { StoreBrandingDto } from "./dto/store-branding.dto";
import { StoreBrandingService } from "./store-branding.service";

@ApiTags("store branding")
@ApiBearerAuth()
@Controller("admin/store/branding")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("catalog.manage")
export class StoreBrandingController {
  constructor(@Inject(StoreBrandingService) private readonly service: StoreBrandingService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.getState(user.tenantId);
  }

  @Put()
  saveDraft(@CurrentUser() user: AuthUser, @Body() dto: StoreBrandingDto) {
    return this.service.saveDraft(user.tenantId, user.id, dto);
  }

  @Post("preview")
  preview(@CurrentUser() user: AuthUser, @Body() dto: StoreBrandingDto) {
    return this.service.preview(user.tenantId, dto);
  }

  @Post("publish")
  publish(@CurrentUser() user: AuthUser) {
    return this.service.publishDraft(user.tenantId, user.id);
  }

  @Get("history")
  history(@CurrentUser() user: AuthUser) {
    return this.service.history(user.tenantId);
  }

  @Post("restore")
  restore(@CurrentUser() user: AuthUser) {
    return this.service.restorePrevious(user.tenantId, user.id);
  }
}
