import { OrderStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORDER_QUEUE_CONFIG,
  parseOrderQueueConfig,
} from "./order-queue-config";
import { PublicOrderQueueService } from "./public-order-queue.service";

describe("PublicOrderQueueService", () => {
  it("uses safe defaults and rejects unsafe configuration values", () => {
    expect(parseOrderQueueConfig({
      orderQueue: {
        completedLimit: 500,
        staleAfterSeconds: 1,
        activeStatuses: ["PENDING", "CANCELLED"],
      },
    })).toEqual({
      ...DEFAULT_ORDER_QUEUE_CONFIG,
      activeStatuses: [OrderStatus.PENDING],
    });
  });

  it("projects ordered queue entries without payment, phone or address data", async () => {
    const active = [
      order("older", "A01", OrderStatus.PENDING, "2026-07-30T10:00:00Z", "Cliente 11999999999"),
      order("newer", "A02", OrderStatus.PREPARING, "2026-07-30T10:05:00Z", "Ana"),
    ];
    const completed = [
      order("latest", "A03", OrderStatus.DELIVERED, "2026-07-30T10:10:00Z", "Bia"),
    ];
    const prisma = {
      tenant: {
        findFirst: vi.fn(async () => ({
          id: "tenant-a",
          name: "Loja A",
          config: { orderQueue: { showNickname: true } },
        })),
      },
      order: {
        findMany: vi.fn()
          .mockResolvedValueOnce(active)
          .mockResolvedValueOnce(completed),
      },
    };

    const result = await new PublicOrderQueueService(prisma as never)
      .bySlug("loja-a", new Date("2026-07-30T10:15:00Z"));

    expect(result.active.map((item) => item.publicCode)).toEqual(["A01", "A02"]);
    expect(result.active[0]?.displayName).toBeNull();
    expect(result.active[1]?.displayName).toBe("Ana");
    expect(result.completed.map((item) => item.publicCode)).toEqual(["A03"]);
    expect(JSON.stringify(result)).not.toMatch(/phone|address|payment|total/i);
    expect(prisma.order.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 8 }),
    );
  });
});

function order(
  id: string,
  publicCode: string,
  status: OrderStatus,
  date: string,
  customerName: string,
) {
  const occurredAt = new Date(date);
  return {
    id,
    publicCode,
    customerName,
    status,
    createdAt: occurredAt,
    productionStartedAt: status === OrderStatus.PREPARING ? occurredAt : null,
    readyAt: status === OrderStatus.READY ? occurredAt : null,
    completedAt: status === OrderStatus.DELIVERED ? occurredAt : null,
    updatedAt: occurredAt,
  };
}
