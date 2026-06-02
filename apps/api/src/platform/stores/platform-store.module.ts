import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlatformStoreController } from "./platform-store.controller";
import { PlatformStoreService } from "./platform-store.service";

@Module({
  imports: [AuthModule],
  controllers: [PlatformStoreController],
  providers: [PlatformStoreService],
  exports: [PlatformStoreService],
})
export class PlatformStoreModule {}
