import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PlatformAdminGuard } from "./platform-admin.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PlatformAdminGuard],
  exports: [AuthService, JwtAuthGuard, PlatformAdminGuard],
})
export class AuthModule {}
