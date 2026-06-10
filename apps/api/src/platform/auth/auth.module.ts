import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthCryptoService } from "../../auth/auth-crypto.service";
import { CurrentUserService } from "../../auth/current-user.service";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { StoreScopeGuard } from "../../auth/guards/store-scope.guard";
import { PasswordResetService } from "../../auth/password-reset.service";
import { SessionTokenService } from "../../auth/session-token.service";
import { StoreContextController } from "../../auth/store-context.controller";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { FinancialManagementRolesGuard, OrderMaintenanceRolesGuard } from "./roles.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, StoreContextController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PlatformAdminGuard,
    OrderMaintenanceRolesGuard,
    FinancialManagementRolesGuard,
    AuthCryptoService,
    CurrentUserService,
    PermissionGuard,
    StoreScopeGuard,
    SessionTokenService,
    PasswordResetService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    PlatformAdminGuard,
    OrderMaintenanceRolesGuard,
    FinancialManagementRolesGuard,
    AuthCryptoService,
    CurrentUserService,
    PermissionGuard,
    StoreScopeGuard,
    SessionTokenService,
    PasswordResetService,
  ],
})
export class AuthModule {}
