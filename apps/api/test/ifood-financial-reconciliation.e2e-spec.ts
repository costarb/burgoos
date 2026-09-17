import { describe, expect, it, vi } from "vitest";
import { IfoodFinancialController } from "../src/management/sales-integrations/ifood/ifood-financial.controller";

describe("iFood financial reconciliation admin contract", () => {
  it("creates, lists and gets only through the authenticated tenant scope", async () => {
    const run = {
      id: "run",
      status: "PENDING",
      trigger: "MANUAL",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-07"),
      salesCount: 0,
      eventCount: 0,
      settlementCount: 0,
      divergentCount: 0,
      errorCode: null,
      errorMessage: null,
    };
    const service = {
      createRun: vi.fn().mockResolvedValue(run),
      listRuns: vi.fn().mockResolvedValue([run]),
      getRun: vi.fn().mockResolvedValue(run),
    };
    const processor = { queue: vi.fn() };
    const readiness = {};
    const controller = new IfoodFinancialController(
      service as never,
      processor as never,
      readiness as never
    );
    const user = { id: "user", tenantId: "tenant" } as never;
    const created = await controller.create(user, "integration", {
      startDate: "2026-09-01",
      endDate: "2026-09-07",
    });
    const listed = await controller.list(user, "integration");
    const fetched = await controller.get(user, "integration", "run");
    expect(service.createRun).toHaveBeenCalledWith(
      "tenant",
      "user",
      "integration",
      "2026-09-01",
      "2026-09-07"
    );
    expect(service.listRuns).toHaveBeenCalledWith("tenant", "integration");
    expect(service.getRun).toHaveBeenCalledWith("tenant", "integration", "run");
    expect(processor.queue).toHaveBeenCalledWith("run", "tenant");
    expect(created).toEqual(fetched);
    expect(listed.items).toHaveLength(1);
  });

  it("never accepts a tenant id from request parameters or body", () => {
    const names = Object.getOwnPropertyNames(IfoodFinancialController.prototype);
    expect(names).toEqual(
      expect.arrayContaining(["create", "list", "get", "requestFile", "file", "download"])
    );
    expect(IfoodFinancialController.prototype.create.length).toBe(3);
  });
});
