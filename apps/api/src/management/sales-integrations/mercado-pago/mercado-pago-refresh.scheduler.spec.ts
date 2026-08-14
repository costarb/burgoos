/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";

import { MercadoPagoRefreshScheduler } from "./mercado-pago-refresh.scheduler";

describe("MercadoPagoRefreshScheduler", () => {
  it("pages eligible connections and refreshes sequentially in legacy mode", async () => {
    const pageOne = [
      { id: "i-1", tenantId: "tenant-a" },
      { id: "i-2", tenantId: "tenant-b" },
    ];
    const pageTwo = [{ id: "i-3", tenantId: "tenant-a" }];
    const findMany = vi.fn().mockResolvedValueOnce(pageOne).mockResolvedValueOnce(pageTwo);
    let active = 0;
    let maxActive = 0;
    const refresh = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return true;
    });
    const scheduler = new MercadoPagoRefreshScheduler(
      { salesIntegration: { findMany } } as any,
      { refresh } as any,
      { get: vi.fn((key: string) => key === "MP_DISCOVERY_BATCH_SIZE" ? "2" : "false") } as any
    );

    await scheduler.renewExpiring();

    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: { id: "i-2" }, skip: 1, take: 2 }));
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
  });

  it("enqueues bounded refresh jobs when durable mode is enabled", async () => {
    const enqueue = vi.fn().mockResolvedValue({ id: "job" });
    const scheduler = new MercadoPagoRefreshScheduler(
      { salesIntegration: { findMany: vi.fn().mockResolvedValue([{ id: "i-1", tenantId: "tenant-a" }]) } } as any,
      { refresh: vi.fn() } as any,
      { get: vi.fn((key: string) => key === "MP_REFRESH_DURABLE_JOBS_ENABLED" ? "true" : "25") } as any,
      { enqueue } as any
    );

    await scheduler.renewExpiring();

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      type: "MP_TOKEN_REFRESH",
      targetId: "i-1",
      dedupeKey: "i-1",
    }));
  });
});
