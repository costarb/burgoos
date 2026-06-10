import { Body, Controller, Inject, Patch, UseGuards } from "@nestjs/common";
import { AuthService } from "../platform/auth/auth.service";
import { AuthUser } from "../platform/auth/auth.types";
import { CurrentUser } from "../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../platform/auth/jwt-auth.guard";
import { RefreshTokenDto } from "./dto/login.dto";
import { StoreContextDto } from "./dto/store-context.dto";

@Controller("admin/session")
@UseGuards(JwtAuthGuard)
export class StoreContextController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Patch("store")
  changeStore(
    @CurrentUser() user: AuthUser,
    @Body() dto: StoreContextDto & Partial<RefreshTokenDto>
  ) {
    return this.authService.changeActiveStore(user, dto.storeId, dto.refreshToken);
  }
}
