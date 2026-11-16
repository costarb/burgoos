import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { StoreBrandingController } from "./store-branding.controller";
import { StoreBrandingService } from "./store-branding.service";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [StoreBrandingController],
  providers: [StoreBrandingService],
  exports: [StoreBrandingService],
})
export class BrandingModule {}
