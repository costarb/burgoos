import { HttpException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaymentTerminalService } from "./payment-terminal.service";

function modeSetup(terminal: Record<string, unknown> | null, setOperatingMode: ReturnType<typeof vi.fn>) {
  const update = vi.fn(async ({ data }) => ({ ...terminal, ...data }));
  const prisma = { paymentTerminal: { findFirst: vi.fn(async () => terminal), update } };
  const authenticated = {
    executeForTenant: vi.fn(async ({ request }) => request("secret", { integrationId: "connection-1" })),
  };
  const service = new PaymentTerminalService(prisma as never, authenticated as never, { setOperatingMode } as never);
  return { service, update, authenticated };
}

describe("PaymentTerminalService.setOperatingMode", () => {
  const terminal = { id: "t-1", tenantId: "tenant-1", providerTerminalId: "PAX_Q92__123", enabled: true };

  it("switches the provider terminal to PDV and stores the reported mode", async () => {
    const setOperatingMode = vi.fn(async () => "PDV");
    const { service, update } = modeSetup({ ...terminal, enabled: false }, setOperatingMode);
    const updated = await service.setOperatingMode("tenant-1", "t-1", "PDV");
    expect(setOperatingMode).toHaveBeenCalledWith("secret", "PAX_Q92__123", "PDV");
    expect(update).toHaveBeenCalledWith({ where: { id: "t-1" }, data: { operatingMode: "PDV" } });
    expect(updated.enabled).toBe(false);
  });

  it("disables the terminal for charges when it leaves PDV", async () => {
    const { service, update } = modeSetup(terminal, vi.fn(async () => "STANDALONE"));
    await service.setOperatingMode("tenant-1", "t-1", "STANDALONE");
    expect(update).toHaveBeenCalledWith({ where: { id: "t-1" }, data: { operatingMode: "STANDALONE", enabled: false } });
  });

  it("explains a permission refusal from Mercado Pago and keeps the stored mode", async () => {
    const refused = new HttpException({ code: "PERMISSION_DENIED", message: "x" }, 502);
    const { service, update } = modeSetup(terminal, vi.fn(async () => { throw refused; }));
    await expect(service.setOperatingMode("tenant-1", "t-1", "PDV")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PERMISSION_DENIED", message: expect.stringContaining("nao permitiu mudar o modo") }),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a terminal of another store", async () => {
    const { service, authenticated } = modeSetup(null, vi.fn());
    await expect(service.setOperatingMode("tenant-1", "t-1", "PDV")).rejects.toBeInstanceOf(NotFoundException);
    expect(authenticated.executeForTenant).not.toHaveBeenCalled();
  });
});

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
