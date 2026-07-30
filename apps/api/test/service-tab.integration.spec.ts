import { NotFoundException } from "@nestjs/common";
import { Prisma, ServiceTabStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ServiceTabService } from "../src/ordering/tabs/service-tab.service";

describe("service tab tenant integration", () => {
  it("consolidates multiple orders while always querying the active tenant", async () => {
    const tab = {
      id: "tab-a",
      number: "7",
      displayName: null,
      publicCode: "C0007",
      status: ServiceTabStatus.OPEN,
      assignedUserId: null,
      version: 0,
      openedAt: new Date(),
      closedAt: null,
      notes: null,
      orders: [
        { total: new Prisma.Decimal("12.00") },
        { total: new Prisma.Decimal("18.00") },
      ],
      paymentAllocations: [{ amount: new Prisma.Decimal("5.00") }],
      charges: [],
    };
    const findMany = vi.fn().mockResolvedValue([tab]);
    const service = new ServiceTabService(
      { serviceTab: { findMany } } as never,
      { record: vi.fn() } as never,
    );

    const result = await service.list("tenant-a");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-a" }) }),
    );
    expect(result[0]).toMatchObject({
      grossTotal: "30.00",
      paidAmount: "5.00",
      openBalance: "25.00",
    });
  });

  it("does not expose a tab from another tenant", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new ServiceTabService(
      { serviceTab: { findFirst } } as never,
      { record: vi.fn() } as never,
    );

    await expect(service.detail("tenant-b", "tab-a")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tab-a", tenantId: "tenant-b" } }),
    );
  });
});
