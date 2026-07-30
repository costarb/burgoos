import { forwardRef, Module, OnModuleInit } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { OrderingModule } from "../../ordering/ordering.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { DatabaseModule } from "../../platform/database/database.module";
import { PlatformIntegrationsModule } from "../../platform/integrations/platform-integrations.module";
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
import { IntegrationAuditService } from "./integration-audit.service";
import { SalesIntegrationOperationLockService } from "./sales-integration-operation-lock.service";
import { MercadoPagoClient } from "./mercado-pago/mercado-pago.client";
import { MercadoPagoOAuthService } from "./mercado-pago/mercado-pago-oauth.service";
import { MercadoPagoConnectionService } from "./mercado-pago/mercado-pago-connection.service";
import { MercadoPagoConnectionController } from "./mercado-pago/mercado-pago-connection.controller";
import { MercadoPagoCallbackController } from "./mercado-pago/mercado-pago-callback.controller";
import { MercadoPagoSalesProviderAdapter } from "./mercado-pago/mercado-pago-sales-provider.adapter";
import { ProviderTransactionStateService } from "./provider-transaction-state.service";
import { MercadoPagoSyncController } from "./mercado-pago/mercado-pago-sync.controller";
import { MercadoPagoRefreshService } from "./mercado-pago/mercado-pago-refresh.service";
import { MercadoPagoRefreshScheduler } from "./mercado-pago/mercado-pago-refresh.scheduler";
import { MercadoPagoAuthenticatedRequestService } from "./mercado-pago/mercado-pago-authenticated-request.service";
import { MercadoPagoWebhookSignatureService } from "./mercado-pago/mercado-pago-webhook-signature.service";
import { MercadoPagoWebhookService } from "./mercado-pago/mercado-pago-webhook.service";
import { MercadoPagoWebhookController } from "./mercado-pago/mercado-pago-webhook.controller";
import { MercadoPagoReconciliationService } from "./mercado-pago/mercado-pago-reconciliation.service";
import { MercadoPagoReconciliationScheduler } from "./mercado-pago/mercado-pago-reconciliation.scheduler";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    DatabaseModule,
    PlatformIntegrationsModule,
    forwardRef(() => OrderingModule),
  ],
  controllers: [
    SalesIntegrationController,
    SalesImportController,
    MercadoPagoConnectionController,
    MercadoPagoCallbackController,
    MercadoPagoSyncController,
    MercadoPagoWebhookController,
  ],
  providers: [
    IntegrationAuditService,
    SalesIntegrationOperationLockService,
    MercadoPagoClient,
    MercadoPagoOAuthService,
    MercadoPagoConnectionService,
    MercadoPagoSalesProviderAdapter,
    ProviderTransactionStateService,
    MercadoPagoRefreshService,
    MercadoPagoRefreshScheduler,
    MercadoPagoAuthenticatedRequestService,
    MercadoPagoWebhookSignatureService,
    MercadoPagoWebhookService,
    MercadoPagoReconciliationService,
    MercadoPagoReconciliationScheduler,
    SalesProviderRegistry,
    PagBankEdiClient,
    PagBankSalesProviderAdapter,
    SalesIntegrationService,
    SalesImportPreviewService,
    ExternalSaleIdentityService,
    SalesImportConfirmationService,
    SalesImportHistoryService,
    SalesImportRetentionService,
    SalesImportRunProcessor,
  ],
  exports: [
    SalesIntegrationService,
    IntegrationAuditService,
    SalesIntegrationOperationLockService,
    MercadoPagoAuthenticatedRequestService,
    MercadoPagoWebhookSignatureService,
  ],
})
export class SalesIntegrationsModule implements OnModuleInit {
  constructor(
    private readonly registry: SalesProviderRegistry,
    private readonly pagbank: PagBankSalesProviderAdapter,
    private readonly mercadoPago: MercadoPagoSalesProviderAdapter
  ) {}
  onModuleInit() {
    if (!this.registry) return;
    if (this.pagbank) this.registry.register(this.pagbank);
    if (this.mercadoPago) this.registry.register(this.mercadoPago);
  }
}
