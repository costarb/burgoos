import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./platform/auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { DatabaseModule } from "./platform/database/database.module";
import { HealthController } from "./platform/health.controller";
import { ManagementModule } from "./management/management.module";
import { OperationsModule } from "./operations/operations.module";
import { OrderingModule } from "./ordering/ordering.module";
import { TenantModule } from "./platform/tenant/tenant.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    TenantModule,
    CatalogModule,
    OrderingModule,
    OperationsModule,
    ManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
