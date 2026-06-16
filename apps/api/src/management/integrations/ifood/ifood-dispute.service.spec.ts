import { describe, expect, it, vi } from "vitest";
import { IfoodDisputeService } from "./ifood-dispute.service";

describe("IfoodDisputeService", () => {
  it("persists dispute events against the tenant platform order link", async () => {
    const upsert = vi.fn(async () => ({ id: "dispute-1" }));
    const service = new IfoodDisputeService(
      {
        platformOrderLink: {
          findFirst: vi.fn(async () => ({ id: "link-1" })),
        },
        platformDispute: { upsert },
      } as never,
      {} as never,
      {} as never,
      { record: vi.fn() } as never
    );

    await service.persistFromEvent({
      tenantId: "tenant-1",
      integrationId: "integration-1",
      externalOrderId: "order-1",
      externalDisputeId: "dispute-ext-1",
      status: "PENDING",
      proposal: { refund: 10 },
      expiresAt: new Date("2026-06-16T12:00:00.000Z"),
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          integrationId_externalDisputeId: {
            integrationId: "integration-1",
            externalDisputeId: "dispute-ext-1",
          },
        },
        create: expect.objectContaining({
          tenantId: "tenant-1",
          platformOrderLinkId: "link-1",
        }),
      })
    );
  });

  it("responds to a dispute and records a confirmed sync attempt", async () => {
    const updateAttempt = vi.fn();
    const updateDispute = vi.fn();
    const service = new IfoodDisputeService(
      {
        platformDispute: {
          findFirst: vi.fn(async () => ({
            id: "dispute-1",
            tenantId: "tenant-1",
            integrationId: "integration-1",
            platformOrderLinkId: "link-1",
            externalDisputeId: "dispute-ext-1",
            platformOrderLink: { id: "link-1" },
          })),
          update: updateDispute,
        },
        platformSyncAttempt: {
          create: vi.fn(async () => ({ id: "attempt-1" })),
          update: updateAttempt,
        },
      } as never,
      { getActiveCredentialSecret: vi.fn(async () => ({ accessToken: "token" })) } as never,
      { respondDispute: vi.fn() } as never,
      { record: vi.fn() } as never
    );

    await service.respond({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      integrationId: "integration-1",
      disputeId: "dispute-1",
      accepted: false,
      reason: "Contestacao recusada",
    });

    expect(updateAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attempt-1" },
        data: expect.objectContaining({ status: "CONFIRMED" }),
      })
    );
    expect(updateDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispute-1" },
        data: expect.objectContaining({
          status: "REJECTED",
          respondedAt: expect.any(Date),
        }),
      })
    );
  });
});
