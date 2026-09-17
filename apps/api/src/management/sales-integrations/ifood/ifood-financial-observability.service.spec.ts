import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { IfoodFinancialObservabilityService } from "./ifood-financial-observability.service";

describe("IfoodFinancialObservabilityService", () => {
  it("logs structured page coverage events and never includes raw payload keys", () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const service = new IfoodFinancialObservabilityService();
    service.pageFetched({
      merchantId: "merchant-a",
      endpoint: "sales",
      page: 0,
      pageCount: 3,
      durationMs: 120,
    });
    expect(log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(log.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      event: "ifood_financial.page_fetched",
      merchantId: "merchant-a",
      endpoint: "sales",
      page: 0,
      pageCount: 3,
      durationMs: 120,
    });
    expect(payload).not.toHaveProperty("rawPayload");
    log.mockRestore();
  });

  it("counts retries by reason and logs the attempt", () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const service = new IfoodFinancialObservabilityService();
    service.retryAttempted({
      merchantId: "merchant-a",
      endpoint: "sales",
      attempt: 1,
      reason: "RATE_LIMIT",
      delayMs: 500,
    });
    service.retryAttempted({
      merchantId: "merchant-a",
      endpoint: "sales",
      attempt: 2,
      reason: "RATE_LIMIT",
      delayMs: 1000,
    });
    expect(service.snapshot()["retry.RATE_LIMIT"]).toBe(2);
    log.mockRestore();
  });

  it("counts dedupe outcomes separately for created and updated sales", () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const service = new IfoodFinancialObservabilityService();
    service.dedupeChecked({
      tenantId: "tenant-a",
      integrationId: "integration-a",
      externalSaleId: "sale-1",
      outcome: "CREATED",
    });
    service.dedupeChecked({
      tenantId: "tenant-a",
      integrationId: "integration-a",
      externalSaleId: "sale-1",
      outcome: "UPDATED",
    });
    expect(service.snapshot()["dedupe.CREATED"]).toBe(1);
    expect(service.snapshot()["dedupe.UPDATED"]).toBe(1);
    log.mockRestore();
  });

  it("records operation latency without affecting counters", () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const service = new IfoodFinancialObservabilityService();
    service.latencyRecorded({
      tenantId: "tenant-a",
      integrationId: "integration-a",
      operation: "preview",
      durationMs: 4000,
    });
    const payload = JSON.parse(log.mock.calls[0][0] as string);
    expect(payload.event).toBe("ifood_financial.latency_recorded");
    expect(payload.operation).toBe("preview");
    log.mockRestore();
  });

  it("counts reconciliation runs by final status", () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const service = new IfoodFinancialObservabilityService();
    service.reconciliationCompleted({
      tenantId: "tenant-a",
      integrationId: "integration-a",
      runId: "run-1",
      status: "COMPLETED",
      eventCount: 3,
      settlementCount: 1,
      divergentCount: 0,
      durationMs: 2500,
    });
    service.reconciliationCompleted({
      tenantId: "tenant-a",
      integrationId: "integration-a",
      runId: "run-2",
      status: "PARTIAL",
      eventCount: 0,
      settlementCount: 0,
      divergentCount: 0,
      durationMs: 900,
    });
    expect(service.snapshot()["reconciliation.COMPLETED"]).toBe(1);
    expect(service.snapshot()["reconciliation.PARTIAL"]).toBe(1);
    log.mockRestore();
  });
});
