import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminTenantController } from "./admin-tenant.controller";
import { PublicTenantController } from "./public-tenant.controller";
import { TenantContextService } from "./tenant-context.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminTenantController, PublicTenantController],
  providers: [TenantContextService],
  exports: [TenantContextService]
})
export class TenantModule {}
