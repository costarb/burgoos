import { Injectable, NotFoundException } from "@nestjs/common";
import { FulfillmentMethod, OperationalEventType, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { InventoryService } from "../../operations/inventory/inventory.service";

const activeStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SHIPPED,
];

@Injectable()
export class KdsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async snapshot(tenantId: string, now = new Date()) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId, deletedAt: null, status: { in: activeStatuses } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        items: { include: { modifications: true } },
        platformOrderLink: {
          include: {
            syncAttempts: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    const assignments = await this.assignmentProjection(
      tenantId,
      orders.map((order) => ({
        id: order.id,
        assignedUserId: order.assignedUserId,
        updatedAt: order.updatedAt,
      })),
    );
    return Promise.all(
      orders.map(async (order) => ({
        ...this.project(order, now),
        assignment: assignments.get(order.id) ?? null,
        stockWarnings: await this.inventory.getOrderStockWarnings(order),
      })),
    );
  }

  async findOne(tenantId: string, orderId: string, now = new Date()) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: {
        items: { include: { modifications: true } },
        platformOrderLink: {
          include: {
            syncAttempts: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!order) throw new NotFoundException("Pedido nao encontrado");
    const assignments = await this.assignmentProjection(tenantId, [
      { id: order.id, assignedUserId: order.assignedUserId, updatedAt: order.updatedAt },
    ]);
    return {
      ...this.project(order, now),
      assignment: assignments.get(order.id) ?? null,
      stockWarnings: await this.inventory.getOrderStockWarnings(order),
    };
  }

  private async assignmentProjection(
    tenantId: string,
    orders: Array<{ id: string; assignedUserId: string | null; updatedAt: Date }>,
  ) {
    const assigned = orders.filter(
      (order): order is { id: string; assignedUserId: string; updatedAt: Date } =>
        Boolean(order.assignedUserId),
    );
    if (assigned.length === 0) return new Map<string, { userId: string; userName: string; assignedAt: string }>();
    const [users, events] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(assigned.map((order) => order.assignedUserId))] } },
        select: { id: true, name: true },
      }),
      this.prisma.orderOperationalEvent.findMany({
        where: {
          tenantId,
          orderId: { in: assigned.map((order) => order.id) },
          type: {
            in: [
              OperationalEventType.ORDER_ASSIGNED,
              OperationalEventType.ORDER_ASSIGNMENT_TRANSFERRED,
            ],
          },
        },
        orderBy: { occurredAt: "desc" },
        select: { orderId: true, occurredAt: true },
      }),
    ]);
    const names = new Map(users.map((user) => [user.id, user.name]));
    const assignedAt = new Map<string, Date>();
    for (const event of events) {
      if (event.orderId && !assignedAt.has(event.orderId)) assignedAt.set(event.orderId, event.occurredAt);
    }
    return new Map(
      assigned.map((order) => [
        order.id,
        {
          userId: order.assignedUserId,
          userName: names.get(order.assignedUserId) ?? "Usuario indisponivel",
          assignedAt: (assignedAt.get(order.id) ?? order.updatedAt).toISOString(),
        },
      ]),
    );
  }

  private project(
    order: Prisma.OrderGetPayload<{
      include: {
        items: { include: { modifications: true } };
        platformOrderLink: {
          include: { syncAttempts: true };
        };
      };
    }>,
    now: Date,
  ) {
    const ageSeconds = Math.max(0, Math.floor((now.getTime() - order.createdAt.getTime()) / 1000));
    const latestSync = order.platformOrderLink?.syncAttempts[0];
    return {
      id: order.id,
      source:
        order.platformOrderLink?.provider === "IFOOD" ? "IFOOD" : order.source,
      publicCode: order.publicCode ?? order.id.slice(0, 8).toUpperCase(),
      status: order.status,
      version: order.version,
      total: order.total.toFixed(2),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fulfillmentMethod: order.fulfillmentMethod,
      paymentMethod: order.paymentMethod,
      paymentInstitution: order.paymentInstitution,
      assignedUserId: order.assignedUserId,
      serviceTabId: order.serviceTabId,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      ageSeconds,
      overdue: ageSeconds >= 15 * 60,
      nextStatuses: nextStatuses(order.status, order.fulfillmentMethod),
      platformProvider: order.platformOrderLink?.provider ?? null,
      externalOrderId: order.platformOrderLink?.externalOrderId ?? null,
      externalMerchantId: order.platformOrderLink?.externalMerchantId ?? null,
      platformExternalStatus: order.platformOrderLink?.externalStatus ?? null,
      platformConfirmationDeadlineAt:
        order.platformOrderLink?.confirmationDeadlineAt?.toISOString() ?? null,
      platformConfirmationState: confirmationState(
        order.status,
        order.platformOrderLink?.confirmationDeadlineAt ?? null,
        now,
      ),
      platformSyncStatus: latestSync?.status ?? null,
      platformSyncAction: latestSync?.action ?? null,
      platformSyncError: latestSync?.errorMessage ?? null,
      platformSyncNextRetryAt: latestSync?.nextRetryAt?.toISOString() ?? null,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        total: item.total.toFixed(2),
        notes: item.notes,
        modifications: item.modifications.map((modification) => ({
          id: modification.id,
          type: modification.type,
          referenceId: modification.ingredientId ?? modification.complementId ?? undefined,
          nameSnapshot: modification.nameSnapshot,
          quantity: modification.quantity.toNumber(),
          unitPriceDelta: modification.unitPriceDelta.toFixed(2),
          totalPriceDelta: modification.totalPriceDelta.toFixed(2),
        })),
      })),
      stockWarnings: [],
    };
  }
}


function confirmationState(
  status: OrderStatus,
  deadline: Date | null,
  now: Date,
): "OK" | "DUE_SOON" | "EXPIRED" | null {
  if (!deadline || status !== OrderStatus.PENDING) return null;
  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs < 0) return "EXPIRED";
  return remainingMs <= 2 * 60_000 ? "DUE_SOON" : "OK";
}

export function nextStatuses(
  status: OrderStatus,
  fulfillmentMethod: FulfillmentMethod,
): OrderStatus[] {
  const cancellation = [OrderStatus.CANCELLED];
  if (status === OrderStatus.PENDING) return [OrderStatus.PREPARING, ...cancellation];
  if (status === OrderStatus.PREPARING) return [OrderStatus.READY, ...cancellation];
  if (status === OrderStatus.READY) {
    return fulfillmentMethod === FulfillmentMethod.DELIVERY
      ? [OrderStatus.SHIPPED, ...cancellation]
      : [OrderStatus.DELIVERED, ...cancellation];
  }
  if (status === OrderStatus.SHIPPED) return [OrderStatus.DELIVERED, ...cancellation];
  return [];
}
