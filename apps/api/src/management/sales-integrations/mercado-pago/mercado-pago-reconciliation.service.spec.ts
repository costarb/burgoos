/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { mercadoPagoApprovedPaymentFixture } from "./__fixtures__/mercado-pago.fixtures";
import { MercadoPagoReconciliationService } from "./mercado-pago-reconciliation.service";

describe("MercadoPagoReconciliationService", () => {
  it.each([24, 168] as const)(
    "reconciles the last %s hours by date_last_updated",
    async (hours) => {
      const prisma: any = { salesIntegration: { update: vi.fn() } };
      const client: any = {
        searchPayments: vi.fn().mockResolvedValue([mercadoPagoApprovedPaymentFixture]),
      };
      const authenticated: any = { execute: vi.fn(({ request }) => request("token")) };
      const states: any = { upsertFromMovement: vi.fn() };
      const locks: any = { acquire: vi.fn().mockResolvedValue(true), release: vi.fn() };
      const service = new MercadoPagoReconciliationService(
        prisma,
        authenticated,
        client,
        states,
        locks,
        { record: vi.fn() } as any
      );
      await expect(service.reconcileConnection("tenant", "integration", hours)).resolves.toBe(true);
      expect(client.searchPayments.mock.calls[0][0].rangeField).toBe("date_last_updated");
      expect(states.upsertFromMovement).toHaveBeenCalled();
    }
  );
  it("skips a connection already claimed by another worker", async () => {
    const service = new MercadoPagoReconciliationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { acquire: vi.fn().mockResolvedValue(false) } as any,
      {} as any
    );
    await expect(service.reconcileConnection("tenant", "integration", 24)).resolves.toBe(false);
  });
});
