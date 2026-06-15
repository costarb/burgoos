import { forwardRef, Module } from "@nestjs/common";
import { OrderingModule } from "../../ordering/ordering.module";
import { DatabaseModule } from "../../platform/database/database.module";
import { DeliveryIntegrationAuditService } from "./delivery-integration-audit.service";
import { DeliveryIntegrationHealthService } from "./delivery-integration-health.service";
import { DeliveryIntegrationsController } from "./delivery-integrations.controller";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";
import { IfoodAuthService } from "./ifood/ifood-auth.service";
import { IfoodClient } from "./ifood/ifood-client";
import { IfoodEventPollerService } from "./ifood/ifood-event-poller.service";

@Module({
  imports: [DatabaseModule, forwardRef(() => OrderingModule)],
  controllers: [DeliveryIntegrationsController],
  providers: [
    DeliveryIntegrationsService,
    DeliveryIntegrationHealthService,
    DeliveryIntegrationAuditService,
    IfoodAuthService,
    IfoodClient,
    IfoodEventPollerService,
  ],
  exports: [DeliveryIntegrationsService, DeliveryIntegrationAuditService],
})
export class DeliveryIntegrationsModule {}
