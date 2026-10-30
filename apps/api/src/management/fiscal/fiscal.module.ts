import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { BackgroundJobsModule } from "../../common/background-jobs/background-jobs.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { PlatformIntegrationsModule } from "../../platform/integrations/platform-integrations.module";
import { AccessAuditService } from "../access/access-audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { FiscalConfigurationController } from "./configuration/fiscal-configuration.controller";
import { FiscalConfigurationService } from "./configuration/fiscal-configuration.service";
import { FiscalIssuerService } from "./configuration/fiscal-issuer.service";
import { FiscalReadinessService } from "./configuration/fiscal-readiness.service";
import { IbgeMunicipalityClient } from "./configuration/ibge-municipality.client";
import { FiscalAuditService } from "./documents/fiscal-audit.service";
import { FiscalCancellationService } from "./documents/fiscal-cancellation.service";
import { FiscalDocumentStateService } from "./documents/fiscal-document-state.service";
import { FiscalDocumentStorageService } from "./documents/fiscal-document-storage.service";
import { FiscalDocumentsController } from "./documents/fiscal-documents.controller";
import { FiscalDocumentsService } from "./documents/fiscal-documents.service";
import { FiscalEmissionProcessor } from "./documents/fiscal-emission.processor";
import { FiscalEmissionService } from "./documents/fiscal-emission.service";
import { FiscalNotifierService } from "./documents/fiscal-notifier.service";
import { FiscalOrderGuardService } from "./documents/fiscal-order-guard.service";
import { FiscalSaleLoader } from "./documents/fiscal-sale.loader";
import { FiscalSyncService } from "./documents/fiscal-sync.service";
import { FiscalTriggerService } from "./documents/fiscal-trigger.service";
import { FiscalXmlExportService } from "./documents/fiscal-xml-export.service";
import { FiscalProfileController } from "./profiles/fiscal-profile.controller";
import { FiscalProfileResolver } from "./profiles/fiscal-profile-resolver";
import { FiscalProfileService } from "./profiles/fiscal-profile.service";
import { BlingConnectionController, BlingOAuthCallbackController } from "./providers/bling/bling-oauth.controller";
import { BlingConnectionService } from "./providers/bling/bling-connection.service";
import { BlingFiscalProviderAdapter } from "./providers/bling/bling-fiscal-provider.adapter";
import { BlingOAuthService } from "./providers/bling/bling-oauth.service";
import { BlingClient } from "./providers/bling/bling.client";
import { FiscalProviderContextService } from "./providers/fiscal-provider-context.service";
import { FiscalProviderRegistry } from "./providers/fiscal-provider.registry";

@Module({
  imports: [AuthModule, BackgroundJobsModule, StorageModule, PlatformIntegrationsModule],
  controllers: [
    FiscalConfigurationController,
    FiscalProfileController,
    FiscalDocumentsController,
    BlingOAuthCallbackController,
    BlingConnectionController,
  ],
  providers: [
    AccessAuditService,
    NotificationsService,
    FiscalProviderRegistry,
    FiscalProviderContextService,
    FiscalAuditService,
    IbgeMunicipalityClient,
    FiscalIssuerService,
    FiscalProfileService,
    FiscalProfileResolver,
    FiscalReadinessService,
    FiscalConfigurationService,
    FiscalSaleLoader,
    FiscalDocumentStorageService,
    FiscalNotifierService,
    FiscalDocumentStateService,
    FiscalCancellationService,
    FiscalEmissionService,
    FiscalEmissionProcessor,
    FiscalSyncService,
    FiscalTriggerService,
    FiscalDocumentsService,
    FiscalOrderGuardService,
    FiscalXmlExportService,
    BlingOAuthService,
    BlingClient,
    BlingFiscalProviderAdapter,
    BlingConnectionService,
  ],
  exports: [
    FiscalProviderRegistry,
    FiscalProviderContextService,
    FiscalAuditService,
    FiscalConfigurationService,
    FiscalProfileResolver,
    FiscalTriggerService,
    FiscalCancellationService,
    FiscalOrderGuardService,
    FiscalDocumentsService,
  ],
})
export class FiscalModule implements OnModuleInit {
  constructor(
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(BlingFiscalProviderAdapter) private readonly bling: BlingFiscalProviderAdapter
  ) {}

  onModuleInit(): void {
    if (!this.registry.has(this.bling.provider)) this.registry.register(this.bling);
  }
}
