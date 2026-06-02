import { Module } from "@nestjs/common";
import { AuthModule } from "../../platform/auth/auth.module";
import { StoreBrandingController } from "./store-branding.controller";
import { StoreBrandingService } from "./store-branding.service";

@Module({
  imports: [AuthModule],
  controllers: [StoreBrandingController],
  providers: [StoreBrandingService],
  exports: [StoreBrandingService],
})
export class BrandingModule {}
