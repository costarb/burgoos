import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreAdminProfileDto } from "./dto/store-onboarding.dto";
import { PlatformStoreService } from "./platform-store.service";

export const STORE_PROFILE_PERMISSION = "store.profile.manage";

/** "Dados da loja": the store admin sees and edits only the store of the session. */
@ApiTags("admin store profile")
@ApiBearerAuth()
@Controller("admin/store-profile")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(STORE_PROFILE_PERMISSION)
export class StoreProfileController {
  constructor(@Inject(PlatformStoreService) private readonly stores: PlatformStoreService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.stores.get(user.tenantId);
  }

  @Put()
  update(@CurrentUser() user: AuthUser, @Body() dto: StoreAdminProfileDto) {
    return this.stores.updateOwnStore(user.tenantId, dto, user.id);
  }
}
