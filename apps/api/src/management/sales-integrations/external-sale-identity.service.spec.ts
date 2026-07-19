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
});
