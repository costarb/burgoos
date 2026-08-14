import { forwardRef, Module } from "@nestjs/common";
import { SalesIntegrationsModule } from "../management/sales-integrations/sales-integrations.module";
import { DatabaseModule } from "../platform/database/database.module";
import { AuthModule } from "../platform/auth/auth.module";
import { MercadoPagoPointClient } from "./mercado-pago-point/mercado-pago-point.client";
import { PaymentTerminalService } from "./mercado-pago-point/payment-terminal.service";
import { PaymentTerminalController } from "./payment-terminal.controller";
import { PaymentChargeController } from "./payment-charge.controller";
import { PaymentChargeService } from "./application/payment-charge.service";
import { PaymentSettlementService } from "./application/payment-settlement.service";
import { ManualPaymentController } from "./manual/manual-payment.controller";
import { ManualPaymentService } from "./manual/manual-payment.service";
import { ManualPaymentReversalService } from "./manual/manual-payment-reversal.service";
import { MercadoPagoOrdersWebhookController } from "./webhooks/mercado-pago-orders-webhook.controller";
import { PaymentProviderEventProcessor } from "./webhooks/payment-provider-event.processor";
import { PointReconciliationService } from "./mercado-pago-point/point-reconciliation.service";
import { PointReconciliationScheduler } from "./mercado-pago-point/point-reconciliation.scheduler";
import { PaymentExceptionService } from "./application/payment-exception.service";
import { PaymentExceptionResolutionService } from "./application/payment-exception-resolution.service";
import { PaymentExceptionController } from "./payment-exception.controller";
import { BackgroundJobsModule } from "../common/background-jobs/background-jobs.module";

@Module({
  imports: [DatabaseModule, AuthModule, BackgroundJobsModule, forwardRef(() => SalesIntegrationsModule)],
  providers: [
    MercadoPagoPointClient,
    PaymentTerminalService,
    PaymentChargeService,
    PaymentSettlementService,
    ManualPaymentService,
    ManualPaymentReversalService,
    PaymentProviderEventProcessor,
    PointReconciliationService,
    PointReconciliationScheduler,
    PaymentExceptionService,
    PaymentExceptionResolutionService,
  ],
  controllers: [
    PaymentTerminalController,
    PaymentChargeController,
    ManualPaymentController,
    MercadoPagoOrdersWebhookController,
    PaymentExceptionController,
  ],
  exports: [MercadoPagoPointClient, PaymentTerminalService],
})
export class PaymentsModule {}
