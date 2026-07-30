import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { OrdersGateway } from "./orders.gateway";

describe("OrdersGateway authentication", () => {
  it("joins only the tenant contained in the verified token", async () => {
    const auth = {
      verifyAccessToken: vi.fn(async () => ({
        sub: "user-1",
        tenantId: "tenant-from-token",
        role: UserRole.OPERATOR,
        email: "atendente@example.com",
        name: "Atendente",
        permissions: ["kds.view"],
      })),
    };
    const client = socket({ token: "valid", tenantId: "forged-tenant" });
    const gateway = new OrdersGateway(auth as never);

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith("tenant:tenant-from-token");
    expect(client.join).not.toHaveBeenCalledWith("tenant:forged-tenant");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects missing, invalid or unauthorized credentials", async () => {
    const missingClient = socket({});
    await new OrdersGateway({ verifyAccessToken: vi.fn() } as never).handleConnection(
      missingClient as never,
    );
    expect(missingClient.disconnect).toHaveBeenCalledWith(true);

    const unauthorizedClient = socket({ token: "valid" });
    const gateway = new OrdersGateway({
      verifyAccessToken: vi.fn(async () => ({
        tenantId: "tenant-1",
        role: UserRole.OPERATOR,
        permissions: [],
      })),
    } as never);
    await gateway.handleConnection(unauthorizedClient as never);
    expect(unauthorizedClient.disconnect).toHaveBeenCalledWith(true);
  });
});

function socket(auth: Record<string, unknown>) {
  return {
    id: "socket-1",
    handshake: { auth, query: {} },
    data: {},
    join: vi.fn(async () => undefined),
    disconnect: vi.fn(),
  };
}
