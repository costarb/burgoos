import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PublicOrderQueueService } from "../src/customer-experience/order-queue/public-order-queue.service";

describe("public order queue contract", () => {
  it("returns the same not-found contract for unknown, inactive and disabled stores", async () => {
    const prisma = {
      tenant: { findFirst: vi.fn().mockResolvedValue(null) },
      order: { findMany: vi.fn() },
    };
    const service = new PublicOrderQueueService(prisma as never);

    await expect(service.bySlug("unknown")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it("always scopes both queue queries to the resolved tenant", async () => {
    const prisma = {
      tenant: {
        findFirst: vi.fn(async () => ({
          id: "tenant-a",
          name: "Loja A",
          config: {},
        })),
      },
      order: {
        findMany: vi.fn(async () => []),
      },
    };
    const service = new PublicOrderQueueService(prisma as never);

    await service.byDomain("www.loja-a.example.com:443");

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicDomain: "loja-a.example.com", active: true },
    }));
    for (const call of prisma.order.findMany.mock.calls as unknown as Array<[unknown]>) {
      expect(call[0]).toEqual(expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }));
    }
  });
});
