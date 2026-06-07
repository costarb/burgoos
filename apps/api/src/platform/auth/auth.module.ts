import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { FinancialManagementRolesGuard, OrderMaintenanceRolesGuard } from "./roles.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PlatformAdminGuard,
    OrderMaintenanceRolesGuard,
    FinancialManagementRolesGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    PlatformAdminGuard,
    OrderMaintenanceRolesGuard,
    FinancialManagementRolesGuard,
  ],
})
export class AuthModule {}
