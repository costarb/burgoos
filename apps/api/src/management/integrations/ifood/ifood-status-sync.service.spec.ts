import { BadGatewayException, ConflictException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { IfoodStatusSyncService } from "./ifood-status-sync.service";

describe("IfoodStatusSyncService", () => {
  it("confirms iFood order and persists a confirmed sync attempt", async () => {
    const link = platformLink();
    const platformSyncAttempt = {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      update: vi.fn(),
    };
    const service = new IfoodStatusSyncService(
      {
        order: {
          findFirst: vi.fn(async () => ({
            id: "order-1",
            status: "PENDING",
            platformOrderLink: link,
          })),
        },
        platformSyncAttempt,
        platformOrderLink: { update: vi.fn() },
      } as never,
      { getActiveCredentialSecret: vi.fn(async () => ({ accessToken: "token" })) } as never,
      { confirmOrder: vi.fn() } as never,
      { record: vi.fn() } as never
    );

    await service.confirmOrder("tenant-1", "user-1", "order-1");

    expect(platformSyncAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CONFIRM",
          status: "PENDING",
          createdByUserId: "user-1",
        }),
      })
    );
    expect(platformSyncAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONFIRMED" }),
      })
    );
  });

  it("rejects confirm after iFood deadline", async () => {
    const service = new IfoodStatusSyncService(
      {
        order: {
          findFirst: vi.fn(async () => ({
            id: "order-1",
            status: "PENDING",
            platformOrderLink: platformLink({
              confirmationDeadlineAt: new Date(Date.now() - 1_000),
            }),
          })),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(service.confirmOrder("tenant-1", "user-1", "order-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("marks attempt as retryable when provider refusal fails", async () => {
    const platformSyncAttempt = {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      update: vi.fn(),
    };
    const service = new IfoodStatusSyncService(
      {
        order: {
          findFirst: vi.fn(async () => ({
            id: "order-1",
            status: "PENDING",
            platformOrderLink: platformLink(),
          })),
        },
        platformCancellationReason: { findFirst: vi.fn(async () => null) },
        platformSyncAttempt,
      } as never,
      { getActiveCredentialSecret: vi.fn(async () => ({ accessToken: "token" })) } as never,
      {
        requestCancellation: vi.fn(async () => Promise.reject(new Error("provider down"))),
      } as never,
      { record: vi.fn() } as never
    );

    await expect(
      service.refuseOrder({
        tenantId: "tenant-1",
        actorUserId: "user-1",
        orderId: "order-1",
        providerReasonId: "501",
      })
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(platformSyncAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RETRYABLE",
          errorCode: "IFOOD_SYNC_FAILED",
        }),
      })
    );
  });

  it("maps shipped takeout orders to ready-to-pickup provider action", async () => {
    const platformSyncAttempt = {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      update: vi.fn(),
    };
    const client = { markReadyToPickup: vi.fn() };
    const service = new IfoodStatusSyncService(
      {
        platformSyncAttempt,
        platformOrderLink: { update: vi.fn() },
      } as never,
      { getActiveCredentialSecret: vi.fn(async () => ({ accessToken: "token" })) } as never,
      client as never,
      { record: vi.fn() } as never
    );

    await service.syncInternalStatus({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      link: {
        id: "link-1",
        integrationId: "integration-1",
        externalOrderId: "ifood-order-1",
        mode: "TAKEOUT",
        internalStatusAtLastSync: "PREPARING",
      },
      status: OrderStatus.SHIPPED,
    });

    expect(client.markReadyToPickup).toHaveBeenCalledWith({
      accessToken: "token",
      orderId: "ifood-order-1",
    });
    expect(platformSyncAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "READY_TO_PICKUP" }),
      })
    );
  });
});

function platformLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "link-1",
    integrationId: "integration-1",
    provider: "IFOOD",
    externalOrderId: "ifood-order-1",
    confirmationDeadlineAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}
