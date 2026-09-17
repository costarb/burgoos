import { describe, expect, it, vi } from "vitest";
import { ExternalSaleIdentityService } from "../src/management/sales-integrations/external-sale-identity.service";

describe("iFood operational and financial identity integration", () => {
  it("converges concurrent attachment attempts on one operational order", async () => {
    const identities = new Map<string, { orderId: string }>();
    const prisma = {
      platformOrderLink: {
        findFirst: vi.fn().mockResolvedValue({ orderId: "operational-order" }),
      },
      externalSaleIdentity: {
        upsert: vi.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: { tenantId_provider_environment_externalSaleId: unknown };
            create: { orderId: string };
            update: { orderId: string };
          }) => {
            const key = JSON.stringify(where.tenantId_provider_environment_externalSaleId);
            const current = identities.get(key);
            const next = current ? { ...current, ...update } : create;
            identities.set(key, next);
            return next;
          }
        ),
      },
    };
    const service = new ExternalSaleIdentityService(prisma as never);
    const key = {
      tenantId: "tenant-a",
      provider: "IFOOD" as const,
      environment: "PRODUCTION" as const,
      integrationId: "financial-integration",
      externalSaleId: "ifood-order",
    };
    const results = await Promise.all([
      service.attachOperationalIfoodOrder(key, "merchant-a", "API"),
      service.attachOperationalIfoodOrder(key, "merchant-a", "API"),
    ]);
    expect(results).toEqual(["operational-order", "operational-order"]);
    expect(identities).toHaveLength(1);
    expect([...identities.values()][0]?.orderId).toBe("operational-order");
  });

  it("does not attach an order returned outside the tenant-scoped lookup", async () => {
    const findFirst = vi.fn(async ({ where }: { where: { tenantId: string } }) =>
      where.tenantId === "tenant-owner" ? { orderId: "owner-order" } : null
    );
    const upsert = vi.fn();
    const service = new ExternalSaleIdentityService({
      platformOrderLink: { findFirst },
      externalSaleIdentity: { upsert },
    } as never);
    const result = await service.attachOperationalIfoodOrder(
      {
        tenantId: "tenant-other",
        provider: "IFOOD",
        environment: "PRODUCTION",
        integrationId: "financial-integration",
        externalSaleId: "ifood-order",
      },
      "merchant-a",
      "API"
    );
    expect(result).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-other" }) })
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});
