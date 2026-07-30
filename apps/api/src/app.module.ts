import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./platform/auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { DatabaseModule } from "./platform/database/database.module";
import { HealthController } from "./platform/health.controller";
import { ManagementModule } from "./management/management.module";
import { OperationsModule } from "./operations/operations.module";
import { OrderingModule } from "./ordering/ordering.module";
import { BrandingModule } from "./customer-experience/branding/branding.module";
import { TenantModule } from "./platform/tenant/tenant.module";
import { PlatformStoreModule } from "./platform/stores/platform-store.module";
import { PlatformUserModule } from "./platform/users/platform-user.module";
import { PlatformIntegrationsModule } from "./platform/integrations/platform-integrations.module";
import { validateEnvironment } from "./config/env.validation";
import { PaymentsModule } from "./payments/payments.module";
import { IdempotencyModule } from "./common/idempotency/idempotency.module";
import { OrderQueueModule } from "./customer-experience/order-queue/order-queue.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    IdempotencyModule,
    AuthModule,
    TenantModule,
    PlatformStoreModule,
    PlatformUserModule,
    PlatformIntegrationsModule,
    BrandingModule,
    OrderQueueModule,
    CatalogModule,
    OrderingModule,
    PaymentsModule,
    OperationsModule,
    ManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
