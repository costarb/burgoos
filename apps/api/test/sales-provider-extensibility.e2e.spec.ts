import { describe, expect, it, vi } from "vitest";
import { SalesImportPreviewService } from "../src/management/sales-integrations/sales-import-preview.service";
import { SalesProviderRegistry } from "../src/management/sales-integrations/sales-provider.registry";
import { SimulatedSalesProviderAdapter } from "../src/management/sales-integrations/testing/simulated-sales-provider.adapter";

describe("sales provider extensibility", () => {
  it("uses alternate channel capabilities through the common registry and preview validation", async () => {
    const registry = new SalesProviderRegistry();
    const simulated = new SimulatedSalesProviderAdapter();
    registry.register(simulated);
    expect(registry.listCapabilities()).toEqual([
      expect.objectContaining({ channels: ["OTHER"], maxPeriodDays: 7 }),
    ]);
    const service = new SalesImportPreviewService(
      { salesImportRun: {} } as never,
      {
        getCredential: vi
          .fn()
          .mockResolvedValue({ integration: { provider: "PAGBANK", status: "ACTIVE" } }),
      } as never,
      registry,
      {} as never
    );
    await expect(
      service.create("tenant", "actor", {
        integrationId: "11111111-1111-4111-8111-111111111111",
        startDate: "2026-07-01",
        endDate: "2026-07-08",
        strategy: "PRICE_WEIGHTED",
      })
    ).rejects.toThrow(/1 e 7/);
    await expect(
      simulated.fetchRange({ startDate: "2026-07-01", endDate: "2026-07-01" })
    ).resolves.toMatchObject({ days: [{ validated: true, movements: [] }] });
  });
});
