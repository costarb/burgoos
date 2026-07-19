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
import { AccountsPayableController } from "./financial/accounts-payable/accounts-payable.controller";
import { AccountsPayableService } from "./financial/accounts-payable/accounts-payable.service";
import { CashMovementService } from "./financial/cash-flow/cash-movement.service";
import { CashFlowController } from "./financial/cash-flow/cash-flow.controller";
import { CashFlowService } from "./financial/cash-flow/cash-flow.service";
import { FinancialAccountService } from "./financial/cash-flow/financial-account.service";
import { FinancialConfigurationController } from "./financial/financial-configuration.controller";
import { FinancialConfigurationService } from "./financial/financial-configuration.service";
import { FinancialAuditService } from "./financial/financial-audit.service";
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
import { ManagementReportController } from "./reports/management-report.controller";
import { ManagementReportService } from "./reports/management-report.service";
import { MenuEngineeringController } from "./reports/menu-engineering.controller";
import { MenuEngineeringService } from "./reports/menu-engineering.service";
import { OrderProfitabilityService } from "./reports/order-profitability.service";
import { SalesReportController } from "./reports/sales-report.controller";
import { SalesReportService } from "./reports/sales-report.service";
import { ReportsService } from "./reports.service";
import { TenantScopeService } from "./tenant-scope";
import { AccessAuditService } from "./access/access-audit.service";
import { AccessAuditController } from "./access/access-audit.controller";
import { AccessProfilesController } from "./access/profiles/access-profiles.controller";
import { AccessProfilesService } from "./access/profiles/access-profiles.service";
import { PermissionsController } from "./access/permissions/permissions.controller";
import { PermissionsService } from "./access/permissions/permissions.service";
import { UsersController } from "./access/users/users.controller";
import { UsersService } from "./access/users/users.service";
import { DeliveryIntegrationsModule } from "./integrations/delivery-integrations.module";
import { ExportJobController } from "./exports/export-job.controller";
import { ExportJobService } from "./exports/export-job.service";
import { ExportJobWorker } from "./exports/export-job.worker";
import { ExportProviderRegistry } from "./exports/export-provider.registry";
import { ManagementReportExportProvider } from "./exports/providers/management-report-export.provider";
import { PayablesExportProvider } from "./exports/providers/payables-export.provider";
import { NotificationsController } from "./notifications/notifications.controller";
import { NotificationsService } from "./notifications/notifications.service";
import { SalesIntegrationsModule } from "./sales-integrations/sales-integrations.module";

@Module({
  imports: [AuthModule, DatabaseModule, DeliveryIntegrationsModule, SalesIntegrationsModule],
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
    ManagementReportController,
    MenuEngineeringController,
    SalesReportController,
    AccountsPayableController,
    CashFlowController,
    AccessAuditController,
    UsersController,
    AccessProfilesController,
    PermissionsController,
    ExportJobController,
    NotificationsController,
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
    ManagementReportService,
    MenuEngineeringService,
    SalesReportService,
    TenantScopeService,
    AuditLogService,
    FinancialAuditService,
    AccountsPayableService,
    FinancialAccountService,
    CashMovementService,
    CashFlowService,
    AccessAuditService,
    UsersService,
    AccessProfilesService,
    PermissionsService,
    ExportJobService,
    ExportJobWorker,
    ExportProviderRegistry,
    PayablesExportProvider,
    ManagementReportExportProvider,
    NotificationsService,
  ],
  exports: [OrderProfitabilityService, DeliveryIntegrationsModule],
})
export class ManagementModule {}
