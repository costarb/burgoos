import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ExternalSaleIdentityService } from "./external-sale-identity.service";

const key = { tenantId: "tenant", provider: "PAGBANK" as const, externalSaleId: "sale" };

describe("ExternalSaleIdentityService", () => {
  it("claims a provider identity with tenant and channel", async () => {
    const create = vi.fn().mockResolvedValue({ id: "identity" });
    const service = new ExternalSaleIdentityService({ externalSaleIdentity: { create } } as never);

    await expect(service.claim(key, "API")).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: { ...key, environment: "PRODUCTION", firstChannel: "API" },
    });
  });

  it("turns the durable unique-key race into a duplicate result", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
    });
    const service = new ExternalSaleIdentityService({
      externalSaleIdentity: { create: vi.fn().mockRejectedValue(conflict) },
    } as never);

    await expect(service.claim(key, "FILE")).resolves.toBe(false);
  });

  it("links identity and movement using the supplied transaction client", async () => {
    const client = {
      externalSaleIdentity: { update: vi.fn() },
      externalSalesMovement: { update: vi.fn() },
    };
    const service = new ExternalSaleIdentityService({} as never);

    await service.linkOrder(client as never, key, "movement", "order");

    expect(client.externalSaleIdentity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_provider_environment_externalSaleId: {
            ...key,
            environment: "PRODUCTION",
          },
        },
        data: expect.objectContaining({ orderId: "order" }),
      })
    );
    expect(client.externalSalesMovement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "movement" },
        data: expect.objectContaining({ status: "IMPORTED", orderId: "order" }),
      })
    );
  });

  it("attaches an existing iFood operational order in the same tenant, merchant and environment", async () => {
    const findFirst = vi.fn().mockResolvedValue({ orderId: "operational-order" });
    const upsert = vi.fn();
    const service = new ExternalSaleIdentityService({
      platformOrderLink: { findFirst },
      externalSaleIdentity: { upsert },
    } as never);
    const result = await service.attachOperationalIfoodOrder(
      {
        tenantId: "tenant",
        provider: "IFOOD",
        environment: "TEST",
        integrationId: "sales-integration",
        externalSaleId: "external-order",
      },
      "merchant",
      "API"
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant",
        provider: "IFOOD",
        externalMerchantId: "merchant",
        externalOrderId: "external-order",
        integration: { environment: "TEST" },
      },
      select: { orderId: true },
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ orderId: "operational-order" }),
        update: expect.objectContaining({ orderId: "operational-order" }),
      })
    );
    expect(result).toBe("operational-order");
  });

  it("does not claim a historical identity when no matching operational order exists", async () => {
    const upsert = vi.fn();
    const service = new ExternalSaleIdentityService({
      platformOrderLink: { findFirst: vi.fn().mockResolvedValue(null) },
      externalSaleIdentity: { upsert },
    } as never);
    await expect(
      service.attachOperationalIfoodOrder(
        { tenantId: "tenant", provider: "IFOOD", externalSaleId: "sale" },
        "merchant",
        "API"
      )
    ).resolves.toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });
});
