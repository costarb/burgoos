import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlatformUserController } from "./platform-user.controller";
import { PlatformUserService } from "./platform-user.service";

@Module({
  imports: [AuthModule],
  controllers: [PlatformUserController],
  providers: [PlatformUserService],
})
export class PlatformUserModule {}
