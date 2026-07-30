import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OperationalAssignmentService } from "./operational-assignment.service";

describe("OperationalAssignmentService", () => {
  it("claims an unassigned order and writes the audit in the same transaction", async () => {
    const { service, tx } = fixture();
    const result = await service.claimOrder(user(), "order-1", { expectedVersion: 2 });

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, version: 2 }),
        data: { assignedUserId: userId, version: { increment: 1 } },
      }),
    );
    expect(tx.orderOperationalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        type: "ORDER_ASSIGNED",
        actorUserId: userId,
      }),
    });
    expect(result).toMatchObject({
      version: 3,
      assignment: { userId, userName: "Ana" },
    });
  });

  it("requires a reason when responsibility changes users", async () => {
    const { service } = fixture({ assignedUserId: otherUserId });
    await expect(
      service.transferOrder(user(), "order-1", {
        expectedVersion: 2,
        assigneeUserId: userId,
        reason: "",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects inactive or cross-store assignees", async () => {
    const { service, prisma } = fixture();
    prisma.user.findFirst.mockResolvedValueOnce(null as never);
    await expect(
      service.transferTab(user(), "tab-1", {
        expectedVersion: 1,
        assigneeUserId: otherUserId,
        reason: "Troca de turno",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns a version conflict when another operator won the update", async () => {
    const { service, tx } = fixture();
    tx.order.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.claimOrder(user(), "order-1", { expectedVersion: 2 }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "ASSIGNMENT_VERSION_CONFLICT" }) });
    expect(tx.orderOperationalEvent.create).not.toHaveBeenCalled();
  });
});

const tenantId = "1b02924c-63ff-430a-a45d-df516a0bb5b4";
const userId = "5a019261-ed89-4085-a7b6-ae7868417f8f";
const otherUserId = "4bd9a27e-5f24-4fe5-9ca5-adc6f904290b";

function user() {
  return { id: userId, tenantId, role: "OPERATOR", name: "Ana", email: "ana@local" } as const;
}

function fixture(current = { assignedUserId: null as string | null }) {
  const tx = {
    order: { updateMany: vi.fn(async () => ({ count: 1 })) },
    serviceTab: { updateMany: vi.fn(async () => ({ count: 1 })) },
    orderOperationalEvent: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    user: {
      findFirst: vi.fn(async () => ({ id: userId, name: "Ana" })),
      findMany: vi.fn(async () => []),
    },
    order: { findFirst: vi.fn(async () => current) },
    serviceTab: { findFirst: vi.fn(async () => current) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return {
    tx,
    prisma,
    service: new OperationalAssignmentService(prisma as never),
  };
}
