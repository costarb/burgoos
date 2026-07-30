import { ConflictException } from "@nestjs/common";
import { Prisma, ServiceTabStatus, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ServiceTabService, deriveTabTotals, normalizeTabNumber } from "./service-tab.service";

const user = {
  id: "user-1",
  tenantId: "tenant-1",
  role: UserRole.ADMIN,
  email: "admin@example.com",
  name: "Admin",
};

describe("ServiceTabService", () => {
  it("derives gross, paid and open balance from multiple orders", () => {
    const totals = deriveTabTotals(
      [{ total: new Prisma.Decimal("20.00") }, { total: new Prisma.Decimal("15.50") }],
      [{ amount: new Prisma.Decimal("10.00") }],
    );
    expect(totals.grossTotal.toFixed(2)).toBe("35.50");
    expect(totals.paidAmount.toFixed(2)).toBe("10.00");
    expect(totals.openBalance.toFixed(2)).toBe("25.50");
    expect(normalizeTabNumber("  João 12 ")).toBe("JOAO12");
  });

  it("excludes cancelled orders from the balance charged to the tab", () => {
    const totals = deriveTabTotals(
      [
        { total: new Prisma.Decimal("21.00"), status: "PENDING" },
        { total: new Prisma.Decimal("20.00"), status: "CANCELLED" },
      ],
      [],
    );

    expect(totals.grossTotal.toFixed(2)).toBe("21.00");
    expect(totals.openBalance.toFixed(2)).toBe("21.00");
  });

  it("starts checkout with optimistic concurrency and records the transition", async () => {
    const tab = aggregateTab();
    const prisma = {
      serviceTab: {
        findFirst: vi.fn().mockResolvedValue(tab),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const events = { record: vi.fn().mockResolvedValue({}) };
    const service = new ServiceTabService(prisma as never, events as never);

    const result = await service.startCheckout(user, "tab-1", { expectedVersion: 2 });

    expect(prisma.serviceTab.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          version: 2,
          status: ServiceTabStatus.OPEN,
        }),
      }),
    );
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ serviceTabId: "tab-1", tenantId: "tenant-1" }),
    );
    expect(result.openBalance).toBe("20.00");
  });

  it("returns VERSION_CONFLICT when another operator changed the tab", async () => {
    const prisma = {
      serviceTab: {
        findFirst: vi.fn().mockResolvedValue(aggregateTab()),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new ServiceTabService(prisma as never, { record: vi.fn() } as never);

    await expect(
      service.startCheckout(user, "tab-1", { expectedVersion: 1 }),
    ).rejects.toMatchObject({
      response: { statusCode: 409, code: "VERSION_CONFLICT" },
    });
  });

  it("does not cancel a tab that already contains orders", async () => {
    const service = new ServiceTabService(
      { serviceTab: { findFirst: vi.fn().mockResolvedValue(aggregateTab()) } } as never,
      { record: vi.fn() } as never,
    );
    await expect(
      service.cancel(user, "tab-1", { expectedVersion: 2, reason: "Cliente desistiu" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function aggregateTab() {
  return {
    id: "tab-1",
    tenantId: "tenant-1",
    number: "12",
    normalizedNumber: "12",
    displayName: "Joao",
    publicCode: "C0012",
    status: ServiceTabStatus.OPEN,
    assignedUserId: null,
    openedByUserId: "user-1",
    checkoutStartedByUserId: null,
    closedByUserId: null,
    openedAt: new Date("2026-07-23T12:00:00Z"),
    checkoutStartedAt: null,
    closedAt: null,
    version: 2,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    orders: [{
      id: "order-1",
      tenantId: "tenant-1",
      publicCode: "101",
      serviceTabId: "tab-1",
      source: "COUNTER",
      status: "PENDING",
      total: new Prisma.Decimal("20.00"),
      customerName: "Joao",
      customerPhone: "",
      fulfillmentMethod: "PICKUP",
      assignedUserId: null,
      version: 0,
      createdAt: new Date(),
      items: [],
    }],
    paymentAllocations: [],
    charges: [],
  };
}
