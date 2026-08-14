import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AccountsPayableService } from "../src/management/financial/accounts-payable/accounts-payable.service";

describe("management reporting bounded reads", () => {
  it("loads one payable page and obtains the full summary separately", async () => {
    const prisma = {
      payable: { findMany: vi.fn().mockResolvedValue([]) },
      $queryRaw: vi.fn().mockResolvedValue([{
        total: 5000n,
        totalExpected: new Prisma.Decimal("100000"),
        totalPaid: new Prisma.Decimal("40000"),
        totalRemaining: new Prisma.Decimal("60000"),
        overdueAmount: new Prisma.Decimal("10000"),
        openCount: 3000n,
        overdueCount: 500n,
      }]),
    };
    const service = new AccountsPayableService(prisma as never, { record: vi.fn() } as never);
    const response = await service.list("tenant-1", { page: 3, pageSize: 25 });

    expect(prisma.payable.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 25 }));
    expect(response).toMatchObject({ page: 3, pageSize: 25, total: 5000 });
    expect(response.summary.totalRemaining).toBe("60000.00");
  });
});
