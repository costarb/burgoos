import { describe, expect, it, vi } from "vitest";
import { MercadoPagoPointClient } from "./mercado-pago-point.client";

describe("MercadoPagoPointClient", () => {
  it("paginates the current Orders terminal endpoint", async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce({
        data: {
          terminals: Array.from({ length: 50 }, (_, index) => ({ id: `t-${index}` })),
        },
        paging: { total: 51 },
      })
      .mockResolvedValueOnce({
        data: { terminals: [{ id: "t-50", operating_mode: "PDV" }] },
        paging: { total: 51 },
      });
    const terminals = await new MercadoPagoPointClient(transport).listTerminals("secret");
    expect(terminals).toHaveLength(51);
    expect(transport).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "/terminals/v1/list?limit=50&offset=50" }),
    );
  });

  it("creates one Point transaction with terminal and idempotency key", async () => {
    const transport = vi.fn(async () => ({ id: "ORD-1", status: "created" }));
    await new MercadoPagoPointClient(transport).createOrder("secret", {
      terminalId: "terminal-1",
      externalReference: "charge_123",
      amount: "25.00",
    }, "idem-1");
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/v1/orders",
      idempotencyKey: "idem-1",
      body: expect.objectContaining({
        type: "point",
        transactions: { payments: [{ amount: "25.00" }] },
        config: expect.objectContaining({
          point: expect.objectContaining({ terminal_id: "terminal-1" }),
        }),
      }),
    }));
  });

  it("uses distinct cancel and refund actions", async () => {
    const transport = vi.fn(async () => ({ id: "ORD-1" }));
    const client = new MercadoPagoPointClient(transport);
    await client.cancelOrder("secret", "ORD-1", "cancel-1");
    await client.refundOrder("secret", "ORD-1", "refund-1", "10.00");
    const paths = transport.mock.calls.map(
      (call) => (call as unknown as [{ path: string }])[0].path,
    );
    expect(paths).toEqual(["/v1/orders/ORD-1/cancel", "/v1/orders/ORD-1/refund"]);
  });
});
