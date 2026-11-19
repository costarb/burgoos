import { describe, expect, it, vi } from "vitest";
import { IntegratedPointSaleMatcher } from "./integrated-point-sale.matcher";

const tenantId = "tenant-1";
const run = { integrationId: "integration-1", channel: "API" as const, environment: "PRODUCTION" as const };
const paidAt = new Date("2026-11-19T17:23:14Z");

function movement(overrides: Record<string, unknown> = {}) {
  return {
    externalSaleId: "189459187443",
    sale: { occurredAt: paidAt.toISOString(), grossAmount: 1 } as never,
    raw: {
      point_of_interaction: { type: "POINT", device: { serial_number: "Q92-1732841522" } },
      additional_info: { poi_id: "Q92-1732841522" },
    },
    ...overrides,
  };
}

function setup(options: { terminal?: unknown; charge?: unknown } = {}) {
  const prisma = {
    paymentTerminal: {
      findFirst: vi.fn(async () =>
        "terminal" in options ? options.terminal : { id: "terminal-1", operatingMode: "PDV" }),
    },
    paymentCharge: {
      findFirst: vi.fn(async () => ("charge" in options ? options.charge : { orderId: "order-pos" })),
    },
    externalSaleIdentity: { upsert: vi.fn(async () => ({})) },
  };
  return { prisma, matcher: new IntegratedPointSaleMatcher(prisma as never) };
}

describe("IntegratedPointSaleMatcher", () => {
  it("links a Point payment to the approved POS charge of the same terminal and amount", async () => {
    const { prisma, matcher } = setup();
    const result = await matcher.match(tenantId, run, movement(), new Date("2026-11-19T17:24:00Z"));

    expect(result).toBe("linked");
    expect(prisma.paymentTerminal.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId, providerTerminalId: { endsWith: "__Q92-1732841522" } },
    }));
    expect(prisma.paymentCharge.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId, terminalId: "terminal-1" }),
    }));
    expect(prisma.externalSaleIdentity.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        provider: "MERCADO_PAGO",
        externalSaleId: "189459187443",
        orderId: "order-pos",
        integrationId: "integration-1",
      }),
      update: {},
    }));
  });

  it("defers a recent payment from a PDV terminal while its charge is not approved", async () => {
    const { prisma, matcher } = setup({ charge: null });
    const result = await matcher.match(tenantId, run, movement(), new Date("2026-11-19T17:30:00Z"));
    expect(result).toBe("defer");
    expect(prisma.externalSaleIdentity.upsert).not.toHaveBeenCalled();
  });

  it("imports normally when no charge shows up within the waiting time", async () => {
    const { matcher } = setup({ charge: null });
    expect(await matcher.match(tenantId, run, movement(), new Date("2026-11-19T17:45:00Z"))).toBeNull();
  });

  it("imports normally a payment typed on a terminal outside PDV mode", async () => {
    const { matcher } = setup({ terminal: { id: "terminal-2", operatingMode: "STANDALONE" }, charge: null });
    expect(await matcher.match(tenantId, run, movement(), new Date("2026-11-19T17:24:00Z"))).toBeNull();
  });

  it("ignores payments that are not from a Point or from a terminal the store does not have", async () => {
    const online = setup();
    expect(await online.matcher.match(tenantId, run, movement({ raw: { point_of_interaction: { type: "CHECKOUT" } } }))).toBeNull();
    expect(online.prisma.paymentTerminal.findFirst).not.toHaveBeenCalled();

    const unknownTerminal = setup({ terminal: null });
    expect(await unknownTerminal.matcher.match(tenantId, run, movement())).toBeNull();
    expect(unknownTerminal.prisma.paymentCharge.findFirst).not.toHaveBeenCalled();
  });
});
