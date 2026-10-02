import { describe, expect, it, vi } from "vitest";
import { OAuthRetentionService } from "./oauth-retention.service";

function createService(consumes = true) {
  const prisma = {
    mcpOAuthAuthorizationRequest: { deleteMany: vi.fn(async () => ({ count: 2 })) },
    mcpOAuthToken: { deleteMany: vi.fn(async () => ({ count: 5 })) },
    mcpOAuthClient: { deleteMany: vi.fn(async () => ({ count: 1 })) },
  };
  const service = new OAuthRetentionService(prisma as never, { consumesBackgroundJobs: consumes } as never);
  return { prisma, service };
}

describe("OAuthRetentionService", () => {
  const now = new Date("2026-10-02T04:00:00.000Z");

  it("purges finished requests, old tokens and unused DCR clients", async () => {
    const { prisma, service } = createService();

    await expect(service.purge(now)).resolves.toEqual({ requests: 2, tokens: 5, clients: 1 });
    expect(prisma.mcpOAuthToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: new Date("2026-09-25T04:00:00.000Z") } },
    });
    expect(prisma.mcpOAuthClient.deleteMany).toHaveBeenCalledWith({
      where: {
        kind: "DCR",
        createdAt: { lt: new Date("2026-09-02T04:00:00.000Z") },
        connections: { none: {} },
      },
    });
    const requestWhere = (prisma.mcpOAuthAuthorizationRequest.deleteMany.mock.calls[0] as unknown[])[0] as {
      where: { OR: unknown[] };
    };
    expect(requestWhere.where.OR).toHaveLength(3);
  });

  it("runs the schedule only on roles that consume background work", async () => {
    const api = createService(false);
    await expect(api.service.scheduledPurge()).resolves.toBeNull();
    expect(api.prisma.mcpOAuthToken.deleteMany).not.toHaveBeenCalled();

    const worker = createService(true);
    await expect(worker.service.scheduledPurge()).resolves.toEqual({ requests: 2, tokens: 5, clients: 1 });
  });
});
