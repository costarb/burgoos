import { describe, expect, it, vi } from "vitest";
import { OperationalAssignmentService } from "../src/ordering/assignments/operational-assignment.service";

describe("operational assignment concurrency", () => {
  it("allows only one operator to claim the same version", async () => {
    let updateAttempt = 0;
    const tx = {
      order: {
        updateMany: vi.fn(async () => ({ count: updateAttempt++ === 0 ? 1 : 0 })),
      },
      serviceTab: { updateMany: vi.fn() },
      orderOperationalEvent: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      user: {
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          name: where.id === firstUserId ? "Ana" : "Bruno",
        })),
      },
      order: { findFirst: vi.fn(async () => ({ assignedUserId: null })) },
      serviceTab: { findFirst: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new OperationalAssignmentService(prisma as never);
    const settled = await Promise.allSettled([
      service.claimOrder(user(firstUserId), orderId, { expectedVersion: 0 }),
      service.claimOrder(user(secondUserId), orderId, { expectedVersion: 0 }),
    ]);

    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(tx.orderOperationalEvent.create).toHaveBeenCalledTimes(1);
  });
});

const tenantId = "1b02924c-63ff-430a-a45d-df516a0bb5b4";
const orderId = "5a019261-ed89-4085-a7b6-ae7868417f8f";
const firstUserId = "4bd9a27e-5f24-4fe5-9ca5-adc6f904290b";
const secondUserId = "7c25cc96-0663-4a5c-b1a9-3342edcce075";

function user(id: string) {
  return { id, tenantId, role: "OPERATOR", name: id, email: `${id}@local` } as never;
}
