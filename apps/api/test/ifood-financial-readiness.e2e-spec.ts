import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { IfoodFinancialController } from "../src/management/sales-integrations/ifood/ifood-financial.controller";
import { REQUIRED_PERMISSION_KEY } from "../src/auth/guards/require-permission.decorator";

describe("iFood financial readiness admin contract", () => {
  function setup() {
    const service = {};
    const processor = {};
    const readiness = {
      get: vi.fn().mockResolvedValue({
        integrationId: "integration",
        status: "READY_TEST",
        environment: "TEST",
        merchantId: "merchant-1",
        permissions: [],
        productionEnabled: false,
        lastValidatedAt: null,
        checks: [],
      }),
      revalidate: vi.fn().mockResolvedValue({
        integrationId: "integration",
        status: "READY_PRODUCTION",
        environment: "PRODUCTION",
        merchantId: "merchant-1",
        permissions: [],
        productionEnabled: true,
        lastValidatedAt: "2026-09-04T00:00:00.000Z",
        checks: [],
      }),
    };
    const controller = new IfoodFinancialController(
      service as never,
      processor as never,
      readiness as never
    );
    return { controller, readiness };
  }

  it("reads readiness scoped only to the authenticated tenant", async () => {
    const { controller, readiness } = setup();
    const user = { id: "user", tenantId: "tenant" } as never;
    const result = await controller.getReadiness(user, "integration");
    expect(readiness.get).toHaveBeenCalledWith("tenant", "integration");
    expect(result.status).toBe("READY_TEST");
  });

  it("revalidates readiness with the acting user for audit purposes", async () => {
    const { controller, readiness } = setup();
    const user = { id: "user", tenantId: "tenant" } as never;
    const result = await controller.revalidateReadiness(user, "integration");
    expect(readiness.revalidate).toHaveBeenCalledWith("tenant", "integration", "user");
    expect(result.productionEnabled).toBe(true);
  });

  it("never accepts a tenant id from request parameters or body", () => {
    expect(IfoodFinancialController.prototype.getReadiness.length).toBe(2);
    expect(IfoodFinancialController.prototype.revalidateReadiness.length).toBe(2);
  });

  it("requires an integrations.sales permission to read or revalidate readiness", () => {
    const readMetadata = Reflect.getMetadata(
      REQUIRED_PERMISSION_KEY,
      IfoodFinancialController.prototype.getReadiness
    );
    const writeMetadata = Reflect.getMetadata(
      REQUIRED_PERMISSION_KEY,
      IfoodFinancialController.prototype.revalidateReadiness
    );
    expect(readMetadata).toEqual(
      expect.arrayContaining(["integrations.sales.view", "integrations.sales.manage"])
    );
    expect(writeMetadata).toEqual(expect.arrayContaining(["integrations.sales.manage"]));
  });
});
