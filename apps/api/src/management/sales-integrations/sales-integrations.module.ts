import { forwardRef, Module, OnModuleInit } from "@nestjs/common";
import { OrderingModule } from "../../ordering/ordering.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { DatabaseModule } from "../../platform/database/database.module";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { PagBankEdiClient } from "./pagbank/pagbank-edi.client";
import { PagBankSalesProviderAdapter } from "./pagbank/pagbank-sales-provider.adapter";
import { SalesImportController } from "./sales-import.controller";
import { SalesImportConfirmationService } from "./sales-import-confirmation.service";
import { SalesImportHistoryService } from "./sales-import-history.service";
import { SalesImportRetentionService } from "./sales-import-retention.service";
import { SalesImportRunProcessor } from "./sales-import-run.processor";
import { SalesImportPreviewService } from "./sales-import-preview.service";
import { SalesIntegrationController } from "./sales-integration.controller";
import { SalesIntegrationService } from "./sales-integration.service";
import { SalesProviderRegistry } from "./sales-provider.registry";
import { ExternalSaleIdentityService } from "./external-sale-identity.service";

@Module({ imports: [AuthModule, DatabaseModule, forwardRef(() => OrderingModule)], controllers: [SalesIntegrationController, SalesImportController], providers: [IntegrationSecretService, SalesProviderRegistry, PagBankEdiClient, PagBankSalesProviderAdapter, SalesIntegrationService, SalesImportPreviewService, ExternalSaleIdentityService, SalesImportConfirmationService, SalesImportHistoryService, SalesImportRetentionService, SalesImportRunProcessor], exports: [SalesIntegrationService] })
export class SalesIntegrationsModule implements OnModuleInit {
  constructor(private readonly registry: SalesProviderRegistry, private readonly pagbank: PagBankSalesProviderAdapter) {}
  onModuleInit() { this.registry.register(this.pagbank); }
}
