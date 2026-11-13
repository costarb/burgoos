import { ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalesAutoImportService } from "../src/management/sales-integrations/auto-import/sales-auto-import.service";
import { NotificationsService } from "../src/management/notifications/notifications.service";
import { createFiscalFakePrisma } from "./support/fiscal-fake-prisma";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-30T15:00:00.000Z"); // 12:00 in São Paulo

describe("sales automatic import (US5)", () => {
  let prisma: ReturnType<typeof createFiscalFakePrisma>;
  let preview: { create: ReturnType<typeof vi.fn>; process: ReturnType<typeof vi.fn> };
  let confirmation: { confirm: ReturnType<typeof vi.fn> };
  let jobs: { enqueue: ReturnType<typeof vi.fn> };
  let service: SalesAutoImportService;
  let logs: Array<Record<string, unknown>>;

  beforeEach(() => {
    prisma = createFiscalFakePrisma({
      salesIntegration: [
        integration("mp", { provider: "MERCADO_PAGO" }),
        integration("pb", { provider: "PAGBANK", autoImportStrategy: "FIXED_PRODUCT", autoImportFixedProductId: "product-1" }),
        integration("if", { provider: "IFOOD" }),
        integration("off", { provider: "MERCADO_PAGO", autoImportEnabled: false }),
        integration("other", { tenantId: OTHER, provider: "MERCADO_PAGO" }),
      ],
      user: [{ id: "owner", tenantId: TENANT, role: "OWNER", status: "ACTIVE" }],
    });
    preview = {
      create: vi.fn(async (_tenant: string, _user: null, dto: { integrationId: string }) => ({ id: `run-${dto.integrationId}` })),
      process: vi.fn(async () => ({ status: "PREVIEW_READY" })),
    };
    confirmation = { confirm: vi.fn(async () => ({ status: "COMPLETED", counts: { found: 3, created: 2, duplicate: 1, failed: 0 } })) };
    jobs = { enqueue: vi.fn(async () => ({})) };
    service = new SalesAutoImportService(prisma as never, preview as never, confirmation as never, jobs as never, new NotificationsService(prisma as never));
    logs = [];
    (service as unknown as { logger: Record<string, (message: string) => void> }).logger = {
      log: (message) => logs.push({ level: "log", ...JSON.parse(message) }),
      warn: (message) => logs.push({ level: "warn", ...JSON.parse(message) }),
      error: (message) => logs.push({ level: "error", ...JSON.parse(message) }),
    };
  });

  function integration(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      tenantId: TENANT,
      status: "ACTIVE",
      autoImportEnabled: true,
      autoImportStrategy: "PRICE_WEIGHTED",
      autoImportFixedProductId: null,
      autoImportConsecutiveFailures: 0,
      autoImportLastErrorCode: null,
      autoImportLastLagSeconds: null,
      autoImportLastAlertAt: null,
      autoImportLastSuccessAt: null,
      ...overrides,
    };
  }

  const row = (id: string) => prisma.table("salesIntegration").find((item) => item.id === id) as Record<string, unknown>;

  it("enqueues one deduplicated job per enabled Mercado Pago / PagBank integration", async () => {
    expect(await service.schedule()).toBe(3);
    expect(jobs.enqueue.mock.calls.map(([input]) => input.dedupeKey).sort()).toEqual([
      "auto-import:mp",
      "auto-import:other",
      "auto-import:pb",
    ]);
    expect(jobs.enqueue.mock.calls[0][0]).toMatchObject({ type: "SALES_AUTO_IMPORT", maxAttempts: 1 });
  });

  it("imports the current day with the configured strategy and records health", async () => {
    prisma.table("externalSalesMovement").push({ id: "m1", integrationId: "pb", kind: "SALE", occurredAt: new Date(NOW.getTime() - 90_000) } as never);

    expect(await service.runCycle(TENANT, "pb", NOW)).toBe("success");

    expect(preview.create).toHaveBeenCalledWith(
      TENANT,
      null,
      expect.objectContaining({ integrationId: "pb", startDate: "2026-10-30", endDate: "2026-10-30", strategy: "FIXED_PRODUCT", fixedProductId: "product-1" }),
      "AUTOMATIC"
    );
    expect(confirmation.confirm).toHaveBeenCalledWith(TENANT, "run-pb");
    expect(row("pb")).toMatchObject({ autoImportConsecutiveFailures: 0, autoImportLastLagSeconds: 90, autoImportLastSuccessAt: NOW });
    expect(logs.find((log) => log.event === "sales.auto_import.cycle")).toMatchObject({
      result: "success",
      provider: "PAGBANK",
      found: 3,
      created: 2,
      duplicate: 1,
      lagSeconds: 90,
    });
  });

  it("also fetches the previous day right after midnight", async () => {
    await service.runCycle(TENANT, "mp", new Date("2026-10-31T03:05:00.000Z")); // 00:05 in São Paulo
    expect(preview.create.mock.calls[0][2]).toMatchObject({ startDate: "2026-10-30", endDate: "2026-10-31" });
  });

  it("skips without failure when a manual import of the period is running", async () => {
    preview.create.mockRejectedValueOnce(new ConflictException("Ja existe processamento sobreposto"));
    expect(await service.runCycle(TENANT, "mp", NOW)).toBe("skipped");
    expect(row("mp").autoImportConsecutiveFailures).toBe(0);
    expect(logs[0]).toMatchObject({ event: "sales.auto_import.cycle", result: "skipped", reason: "OVERLAP" });
  });

  it("counts failures, alerts once per hour after 3 in a row and recovers on success", async () => {
    preview.process.mockResolvedValue({ status: "FAILED" });
    prisma.table("salesImportDay").push({ id: "d1", runId: "run-mp", status: "FAILED", errorCode: "AUTHENTICATION", movementDate: NOW } as never);

    for (let cycle = 0; cycle < 4; cycle++) await service.runCycle(TENANT, "mp", new Date(NOW.getTime() + cycle * 120_000));

    expect(row("mp")).toMatchObject({ autoImportConsecutiveFailures: 4, autoImportLastErrorCode: "AUTHENTICATION" });
    expect(logs.filter((log) => log.event === "sales.auto_import.cycle" && log.result === "failed")).toHaveLength(4);
    expect(logs.filter((log) => log.event === "sales.auto_import.degraded")).toHaveLength(2);
    const notifications = prisma.table("operationalNotification");
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ recipientUserId: "owner", type: "SALES_AUTO_IMPORT_DEGRADED", severity: "WARNING", actionUrl: "/admin/orders/import" });

    preview.process.mockResolvedValue({ status: "PREVIEW_READY" });
    expect(await service.runCycle(TENANT, "mp", new Date(NOW.getTime() + 600_000))).toBe("success");
    expect(row("mp")).toMatchObject({ autoImportConsecutiveFailures: 0, autoImportLastErrorCode: null });
  });

  it("isolates a provider exception to its own integration", async () => {
    preview.process.mockImplementation(async (runId: string) => {
      if (runId === "run-mp") throw Object.assign(new Error("fora do ar"), { code: "UNAVAILABLE" });
      return { status: "PREVIEW_READY" };
    });

    expect(await service.runCycle(TENANT, "mp", NOW)).toBe("failed");
    expect(await service.runCycle(TENANT, "pb", NOW)).toBe("success");
    expect(row("mp").autoImportLastErrorCode).toBe("UNAVAILABLE");
    expect(row("pb").autoImportConsecutiveFailures).toBe(0);
  });

  it("ignores disabled integrations and other tenants' ids", async () => {
    expect(await service.runCycle(TENANT, "off", NOW)).toBe("skipped");
    expect(await service.runCycle(TENANT, "other", NOW)).toBe("skipped");
    expect(preview.create).not.toHaveBeenCalled();
  });
});
