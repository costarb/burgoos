import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { FISCAL_PERMISSIONS } from "../fiscal-permissions";
import { FiscalProfileAssignmentsDto, FiscalProfileDto } from "./dto/fiscal-profile.dto";
import { FiscalProfileService } from "./fiscal-profile.service";

@ApiTags("admin fiscal")
@ApiBearerAuth()
@Controller("admin/fiscal")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(FISCAL_PERMISSIONS.configure)
export class FiscalProfileController {
  constructor(@Inject(FiscalProfileService) private readonly profiles: FiscalProfileService) {}

  @Get("profiles")
  @RequirePermission(FISCAL_PERMISSIONS.view, FISCAL_PERMISSIONS.configure)
  list(@CurrentUser() user: AuthUser) {
    return this.profiles.list(user.tenantId);
  }

  @Post("profiles")
  create(@CurrentUser() user: AuthUser, @Body() dto: FiscalProfileDto) {
    return this.profiles.create(user, dto);
  }

  @Patch("profiles/:id")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: FiscalProfileDto) {
    return this.profiles.update(user, id, dto);
  }

  @Delete("profiles/:id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.profiles.remove(user, id);
  }

  @Put("profile-assignments")
  assign(@CurrentUser() user: AuthUser, @Body() dto: FiscalProfileAssignmentsDto) {
    return this.profiles.assign(user, dto);
  }

  @Get("profile-assignments/missing")
  @RequirePermission(FISCAL_PERMISSIONS.view, FISCAL_PERMISSIONS.configure)
  missing(@CurrentUser() user: AuthUser) {
    return this.profiles.missing(user.tenantId);
  }
}
