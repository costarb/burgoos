import { Module } from "@nestjs/common";
import { BrandingModule } from "../../customer-experience/branding/branding.module";
import { AuthModule } from "../auth/auth.module";
import { AdminTenantController } from "./admin-tenant.controller";
import { PublicTenantController } from "./public-tenant.controller";
import { TenantContextService } from "./tenant-context.service";

@Module({
  imports: [AuthModule, BrandingModule],
  controllers: [AdminTenantController, PublicTenantController],
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantModule {}
