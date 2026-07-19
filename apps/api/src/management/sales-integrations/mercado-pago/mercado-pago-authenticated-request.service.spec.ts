/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoAuthenticatedRequestService } from "./mercado-pago-authenticated-request.service";

describe("MercadoPagoAuthenticatedRequestService", () => {
  it("refreshes and retries an OAuth request only once after 401", async () => {
    const integrations: any = {
      getCredential: vi
        .fn()
        .mockResolvedValueOnce({ token: "old", integration: { credentialMode: "OAUTH" } })
        .mockResolvedValueOnce({ token: "new", integration: { credentialMode: "OAUTH" } }),
    };
    const refresh: any = { refresh: vi.fn().mockResolvedValue(true) };
    const request = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error(), { status: 401 }))
      .mockResolvedValueOnce("ok");
    const service = new MercadoPagoAuthenticatedRequestService(integrations, refresh, {
      salesIntegration: { updateMany: vi.fn() },
    } as any);
    await expect(service.execute({ tenantId: "t", integrationId: "i", request })).resolves.toBe(
      "ok"
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(refresh.refresh).toHaveBeenCalledTimes(1);
  });
  it("never refreshes a fixed token and requires replacement", async () => {
    const integrations: any = {
      getCredential: vi
        .fn()
        .mockResolvedValue({ token: "fixed", integration: { credentialMode: "FIXED_TOKEN" } }),
    };
    const refresh: any = { refresh: vi.fn() };
    const updateMany = vi.fn();
    const service = new MercadoPagoAuthenticatedRequestService(integrations, refresh, {
      salesIntegration: { updateMany },
    } as any);
    await expect(
      service.execute({
        tenantId: "t",
        integrationId: "i",
        request: vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 401 })),
      })
    ).rejects.toMatchObject({ status: 401 });
    expect(refresh.refresh).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalled();
  });
});
