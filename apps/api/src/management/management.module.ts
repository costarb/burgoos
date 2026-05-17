import { Module } from "@nestjs/common";
import { AuthModule } from "../platform/auth/auth.module";
import { DatabaseModule } from "../platform/database/database.module";
import { AuditLogService } from "./audit-log";
import { DailySummaryController } from "./daily-summary.controller";
import { OrderPlatformController } from "./domains/order-platform.controller";
import { OrderPlatformService } from "./domains/order-platform.service";
import { PurchaseUnitController } from "./domains/purchase-unit.controller";
import { PurchaseUnitService } from "./domains/purchase-unit.service";
import { SupplierController } from "./domains/supplier.controller";
import { SupplierService } from "./domains/supplier.service";
import { FinancialConfigurationController } from "./financial/financial-configuration.controller";
import { FinancialConfigurationService } from "./financial/financial-configuration.service";
import { IngredientController } from "./financial/ingredient.controller";
import { IngredientService } from "./financial/ingredient.service";
import { TechnicalSheetController } from "./financial/technical-sheet.controller";
import { TechnicalSheetService } from "./financial/technical-sheet.service";
import { PricingController } from "./pricing/pricing.controller";
import { ProductCostSnapshotService } from "./pricing/product-cost-snapshot.service";
import { ProductPricingService } from "./pricing/product-pricing.service";
import { DreService } from "./reports/dre.service";
import { FinancialDashboardService } from "./reports/financial-dashboard.service";
import { FinancialReportsController } from "./reports/financial-reports.controller";
import { MenuEngineeringController } from "./reports/menu-engineering.controller";
import { MenuEngineeringService } from "./reports/menu-engineering.service";
import { OrderProfitabilityService } from "./reports/order-profitability.service";
import { ReportsService } from "./reports.service";
import { TenantScopeService } from "./tenant-scope";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    DailySummaryController,
    FinancialConfigurationController,
    PurchaseUnitController,
    SupplierController,
    OrderPlatformController,
    IngredientController,
    TechnicalSheetController,
    PricingController,
    FinancialReportsController,
    MenuEngineeringController,
  ],
  providers: [
    ReportsService,
    FinancialConfigurationService,
    PurchaseUnitService,
    SupplierService,
    OrderPlatformService,
    IngredientService,
    TechnicalSheetService,
    ProductPricingService,
    ProductCostSnapshotService,
    OrderProfitabilityService,
    DreService,
    FinancialDashboardService,
    MenuEngineeringService,
    TenantScopeService,
    AuditLogService,
  ],
  exports: [OrderProfitabilityService],
})
export class ManagementModule {}
