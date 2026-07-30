import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PointReconciliationService } from "./point-reconciliation.service";

@Injectable()
export class PointReconciliationScheduler {
  private running = false;

  constructor(private readonly reconciliation: PointReconciliationService) {}

  @Cron("*/2 * * * *")
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconciliation.reconcilePending();
    } finally {
      this.running = false;
    }
  }
}
