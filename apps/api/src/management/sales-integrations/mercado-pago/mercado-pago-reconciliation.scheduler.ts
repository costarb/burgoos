import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MercadoPagoReconciliationService } from "./mercado-pago-reconciliation.service";

@Injectable()
export class MercadoPagoReconciliationScheduler {
  constructor(private readonly reconciliation: MercadoPagoReconciliationService) {}
  @Cron("0 */15 * * * *")
  short() {
    return this.reconciliation.reconcile(24);
  }
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  daily() {
    return this.reconciliation.reconcile(168);
  }
}
