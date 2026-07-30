import { describe, expect, it, vi } from "vitest";
import { PaymentTerminalService } from "./payment-terminal.service";

describe("PaymentTerminalService", () => {
  it("normalizes numeric Mercado Pago store and POS identifiers before persistence", async () => {
    const upsert = vi.fn(async ({ create }) => create);
    const prisma = {
      paymentTerminal: { upsert },
    };
    const authenticated = {
      executeForTenant: vi.fn(async ({ request }) =>
        request("secret", { integrationId: "connection-1" })),
    };
    const client = {
      listTerminals: vi.fn(async () => [{
        id: "PAX_A910__123456",
        store_id: 123,
        pos_id: 456,
        operating_mode: "PDV",
      }]),
    };
    const service = new PaymentTerminalService(
      prisma as never,
      authenticated as never,
      client as never,
    );

    const terminals = await service.synchronize("tenant-1");

    expect(terminals).toHaveLength(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        providerStoreId: "123",
        providerPosId: "456",
      }),
    }));
  });
});
