import { describe, expect, it, vi } from "vitest";
import { PayablesExportProvider } from "./payables-export.provider";

describe("PayablesExportProvider", () => {
  it("counts separately and reads bounded pages through an opaque cursor", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ items: [], total: 3 })
      .mockResolvedValueOnce({ items: [payable("one"), payable("two")], total: 3 })
      .mockResolvedValueOnce({ items: [payable("three")], total: 3 });
    const provider = new PayablesExportProvider({ list } as never);
    const job = {
      id: "export-1",
      tenantId: "tenant-1",
      requestedByUserId: "user-1",
      filtersSnapshot: { status: "OPEN" },
      columnsSnapshot: null,
    };

    const descriptor = await provider.describe(job);
    const first = await provider.readBatch(job, null, 2);
    const second = await provider.readBatch(job, first.nextCursor, 2);

    expect(descriptor.totalRows).toBe(3);
    expect(first).toMatchObject({ nextCursor: "2", rows: [{ description: "one" }, { description: "two" }] });
    expect(second).toMatchObject({ nextCursor: null, rows: [{ description: "three" }] });
    expect(list).toHaveBeenNthCalledWith(2, "tenant-1", expect.objectContaining({ page: 1, pageSize: 2 }));
    expect(list).toHaveBeenNthCalledWith(3, "tenant-1", expect.objectContaining({ page: 2, pageSize: 2 }));
  });
});

function payable(description: string) {
  return {
    description,
    categoryName: "Categoria",
    supplierName: null,
    competenceDate: null,
    dueDate: "2026-08-13",
    expectedAmount: "10.00",
    paidAmount: "0.00",
    remainingAmount: "10.00",
    status: "OPEN",
  };
}
