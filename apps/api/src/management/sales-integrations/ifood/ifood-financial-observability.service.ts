import { Injectable, Logger } from "@nestjs/common";

/**
 * Structured, redaction-safe logging and lightweight in-process counters for the iFood
 * financial integration. Never receives raw provider payloads: callers pass only
 * identifiers, counts and timings.
 */
@Injectable()
export class IfoodFinancialObservabilityService {
  private readonly logger = new Logger(IfoodFinancialObservabilityService.name);
  private readonly counters = new Map<string, number>();

  /**
   * One external API call finished: page coverage and latency for a single request.
   * The client authenticates by merchant, not tenant, so `merchantId` is the available
   * correlation id at this layer.
   */
  pageFetched(input: {
    merchantId: string;
    endpoint: "sales" | "financial-events" | "settlements" | "reconciliation-on-demand";
    page: number;
    pageCount?: number;
    durationMs: number;
  }): void {
    this.increment(`page_fetched.${input.endpoint}`);
    this.emit("ifood_financial.page_fetched", input);
  }

  /** A request was retried after a timeout, 429 or 5xx response. */
  retryAttempted(input: {
    merchantId: string;
    endpoint: string;
    attempt: number;
    reason: "TIMEOUT" | "RATE_LIMIT" | "UNAVAILABLE";
    delayMs: number;
  }): void {
    this.increment(`retry.${input.reason}`);
    this.emit("ifood_financial.retry_attempted", input);
  }

  /** A canonical financial sale was matched against an existing record before persisting. */
  dedupeChecked(input: {
    tenantId: string;
    integrationId: string;
    externalSaleId: string;
    outcome: "CREATED" | "UPDATED";
  }): void {
    this.increment(`dedupe.${input.outcome}`);
    this.emit("ifood_financial.dedupe_checked", input);
  }

  /** Wall-clock duration for a higher-level operation (preview, confirmation, reconciliation run). */
  latencyRecorded(input: {
    tenantId: string;
    integrationId: string;
    operation: string;
    durationMs: number;
  }): void {
    this.emit("ifood_financial.latency_recorded", input);
  }

  /** A reconciliation run finished fetching events/settlements for a period. */
  reconciliationCompleted(input: {
    tenantId: string;
    integrationId: string;
    runId: string;
    status: "COMPLETED" | "PARTIAL" | "FAILED";
    eventCount: number;
    settlementCount: number;
    divergentCount: number;
    durationMs: number;
  }): void {
    this.increment(`reconciliation.${input.status}`);
    this.emit("ifood_financial.reconciliation_completed", input);
  }

  /** Snapshot of in-process counters, mainly for tests and health diagnostics. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  private increment(key: string): void {
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  private emit(event: string, values: Record<string, unknown>): void {
    this.logger.log(JSON.stringify({ event, ...values }));
  }
}
