import { Inject, Injectable } from "@nestjs/common";
import { OrderSource, OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import type { FiscalTargetType } from "../fiscal.types";
import type { ComposerOrderItem, ComposerPayment } from "./nfce-composer";

export interface FiscalTarget {
  type: FiscalTargetType;
  id: string;
}

/** Everything needed to decide eligibility and compose the NFC-e of one sale. */
export interface FiscalSale {
  target: FiscalTarget;
  tenantId: string;
  publicCode: string | null;
  source: OrderSource;
  /** Order ids covered by the document (one for ORDER, the tab's active orders for TAB). */
  orderIds: string[];
  cancelled: boolean;
  /** Order belongs to a tab: the tab is the fiscal unit. */
  partOfTab: string | null;
  /** Marketplace sale (iFood) imported as IMPORT: out of scope for NFC-e in this phase. */
  marketplace: boolean;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  paid: boolean;
  saleOccurredAt: Date;
  items: ComposerOrderItem[];
  payments: ComposerPayment[];
  fallbackPaymentMethod: PaymentMethod;
  consumerDocument: string | null;
}

export const activeKeyOf = (target: FiscalTarget) => `${target.type === "ORDER" ? "order" : "tab"}:${target.id}`;

const SOURCES_PAID_ON_CREATION: OrderSource[] = [OrderSource.IMPORT, OrderSource.API];

type LoadedOrder = Prisma.OrderGetPayload<{
  include: {
    items: { include: { modifications: true } };
    paymentAllocations: { include: { payment: true } };
    orderPlatform: true;
  };
}>;

const isMarketplace = (order: Pick<LoadedOrder, "paymentInstitution" | "orderPlatform">) =>
  order.paymentInstitution === "IFOOD" || /ifood/i.test(order.orderPlatform?.name ?? "");

@Injectable()
export class FiscalSaleLoader {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(tenantId: string, target: FiscalTarget): Promise<FiscalSale | null> {
    return target.type === "ORDER" ? this.loadOrder(tenantId, target.id) : this.loadTab(tenantId, target.id);
  }

  private async loadOrder(tenantId: string, orderId: string): Promise<FiscalSale | null> {
    const order = (await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: { include: { modifications: true } },
        paymentAllocations: { include: { payment: true } },
        orderPlatform: true,
      },
    })) as LoadedOrder | null;
    if (!order) return null;
    const payments = validAllocations(order.paymentAllocations);
    const paidAmount = sum(payments.map((payment) => payment.amount));
    const total = new Prisma.Decimal(order.total);
    return {
      target: { type: "ORDER", id: order.id },
      tenantId,
      publicCode: order.publicCode,
      source: order.source,
      orderIds: [order.id],
      cancelled: order.status === OrderStatus.CANCELLED || order.deletedAt !== null,
      partOfTab: order.serviceTabId,
      marketplace: isMarketplace(order),
      total,
      paidAmount,
      paid: SOURCES_PAID_ON_CREATION.includes(order.source) || paidAmount.greaterThanOrEqualTo(total),
      saleOccurredAt: order.createdAt,
      items: order.items.map(toComposerItem),
      payments,
      fallbackPaymentMethod: order.paymentMethod,
      consumerDocument: order.consumerDocument,
    };
  }

  private async loadTab(tenantId: string, tabId: string): Promise<FiscalSale | null> {
    const tab = await this.prisma.serviceTab.findFirst({
      where: { id: tabId, tenantId },
      include: {
        paymentAllocations: { include: { payment: true } },
        orders: {
          include: {
            items: { include: { modifications: true } },
            paymentAllocations: { include: { payment: true } },
          },
        },
      },
    });
    if (!tab) return null;
    const orders = (tab.orders as LoadedOrder[]).filter(
      (order) => order.status !== OrderStatus.CANCELLED && order.deletedAt === null
    );
    const payments = [
      ...validAllocations(tab.paymentAllocations),
      ...orders.flatMap((order) => validAllocations(order.paymentAllocations)),
    ];
    const total = sum(orders.map((order) => order.total));
    const paidAmount = sum(payments.map((payment) => payment.amount));
    const lastOrder = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      target: { type: "TAB", id: tab.id },
      tenantId,
      publicCode: tab.publicCode,
      source: OrderSource.COUNTER,
      orderIds: orders.map((order) => order.id),
      cancelled: tab.status === "CANCELLED",
      partOfTab: null,
      marketplace: false,
      total,
      paidAmount,
      paid: tab.status === "PAID" || (total.greaterThan(0) && paidAmount.greaterThanOrEqualTo(total)),
      saleOccurredAt: tab.closedAt ?? lastOrder?.createdAt ?? tab.openedAt,
      items: orders.flatMap((order) => order.items.map(toComposerItem)),
      payments,
      fallbackPaymentMethod: lastOrder?.paymentMethod ?? PaymentMethod.CASH,
      consumerDocument: tab.consumerDocument,
    };
  }
}

function validAllocations(
  allocations: Array<{ amount: Prisma.Decimal; payment: { method: PaymentMethod; cancelledAt: Date | null; refundedAt: Date | null } | null }>
): ComposerPayment[] {
  return allocations
    .filter((allocation) => allocation.payment && !allocation.payment.cancelledAt && !allocation.payment.refundedAt)
    .map((allocation) => ({ method: allocation.payment!.method, amount: new Prisma.Decimal(allocation.amount) }));
}

function sum(values: Prisma.Decimal.Value[]) {
  return values.reduce<Prisma.Decimal>((total, value) => total.add(new Prisma.Decimal(value)), new Prisma.Decimal(0));
}

function toComposerItem(item: LoadedOrder["items"][number]): ComposerOrderItem {
  return {
    productId: item.productId,
    productNameSnapshot: item.productNameSnapshot,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    baseUnitPrice: item.baseUnitPrice,
    calculatedUnitPrice: item.calculatedUnitPrice,
    chargedUnitPrice: item.chargedUnitPrice,
    modifications: item.modifications.map((modification) => ({
      type: modification.type,
      complementId: modification.complementId,
      nameSnapshot: modification.nameSnapshot,
      quantity: modification.quantity,
      unitPriceDelta: modification.unitPriceDelta,
      totalPriceDelta: modification.totalPriceDelta,
    })),
  };
}
