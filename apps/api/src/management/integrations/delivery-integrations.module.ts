import { forwardRef, Module } from "@nestjs/common";
import { OrderingModule } from "../../ordering/ordering.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { DatabaseModule } from "../../platform/database/database.module";
import { DeliveryIntegrationAuditService } from "./delivery-integration-audit.service";
import { DeliveryIntegrationHealthService } from "./delivery-integration-health.service";
import { DeliveryIntegrationsController } from "./delivery-integrations.controller";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";
import { DeliveryProviderRegistryService } from "./delivery-provider-registry.service";
import { IfoodAuthService } from "./ifood/ifood-auth.service";
import { IfoodClient } from "./ifood/ifood-client";
import { IfoodDeliveryTrackingService } from "./ifood/ifood-delivery-tracking.service";
import { IfoodDisputeService } from "./ifood/ifood-dispute.service";
import { IfoodEventPollerService } from "./ifood/ifood-event-poller.service";
import { IfoodStatusSyncService } from "./ifood/ifood-status-sync.service";

@Module({
  imports: [AuthModule, DatabaseModule, forwardRef(() => OrderingModule)],
  controllers: [DeliveryIntegrationsController],
  providers: [
    DeliveryIntegrationsService,
    DeliveryProviderRegistryService,
    DeliveryIntegrationHealthService,
    DeliveryIntegrationAuditService,
    IfoodAuthService,
    IfoodClient,
    IfoodDeliveryTrackingService,
    IfoodDisputeService,
    IfoodEventPollerService,
    IfoodStatusSyncService,
  ],
  exports: [
    DeliveryIntegrationsService,
    DeliveryProviderRegistryService,
    DeliveryIntegrationAuditService,
    IfoodDeliveryTrackingService,
    IfoodDisputeService,
    IfoodStatusSyncService,
  ],
})
export class DeliveryIntegrationsModule {}
