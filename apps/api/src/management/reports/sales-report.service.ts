import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toMoneyString } from "../financial/money";
import { formatLocalDate, ParsedSalesReportQuery } from "./sales-report.types";

type ReportOrder = Prisma.OrderGetPayload<{
  include: {
    items: true;
    orderPlatform: true;
  };
}>;

interface AggregateBucket {
  orderCount: number;
  grossRevenue: Prisma.Decimal;
  acquiredNetRevenue: Prisma.Decimal;
  releasedNetRevenue: Prisma.Decimal;
  receivableNetAmount: Prisma.Decimal;
  paymentFeeAmount: Prisma.Decimal;
}

@Injectable()
export class SalesReportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getReport(tenantId: string, query: ParsedSalesReportQuery) {
    const where = this.buildWhere(tenantId, query);
    const reportReferenceDate = new Date();
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          orderPlatform: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const summary = this.createSummary(orders, reportReferenceDate);
    const totalGross = summary.grossRevenue;

    return {
      filters: {
        start: query.start,
        end: query.end,
        paymentInstitution: query.paymentInstitution,
        paymentMethod: query.paymentMethod,
        orderPlatformId: query.orderPlatformId,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      },
      summary: {
        ...this.formatAggregate(summary),
        periodStart: query.start,
        periodEnd: query.end,
      },
      daily: this.createDailySummaries(
        orders,
        query.periodStart,
        query.periodEnd,
        reportReferenceDate
      ),
      byPaymentInstitution: this.createPaymentDimensionSummary(
        orders,
        totalGross,
        (order) => order.paymentInstitution ?? "NOT_INFORMED",
        (key) => paymentInstitutionLabel(key),
        reportReferenceDate
      ),
      byPaymentMethod: this.createPaymentDimensionSummary(
        orders,
        totalGross,
        (order) => order.paymentMethod,
        (key) => paymentMethodLabel(key),
        reportReferenceDate
      ),
      byChannel: this.createChannelSummary(orders, reportReferenceDate),
      analytical: this.createAnalyticalPage(
        orders,
        total,
        query.page,
        query.pageSize,
        reportReferenceDate
      ),
      receivables: this.createReceivablesSummary(orders, reportReferenceDate),
    };
  }

  private buildWhere(tenantId: string, query: ParsedSalesReportQuery): Prisma.OrderWhereInput {
    return {
      tenantId,
      deletedAt: null,
      createdAt: {
        gte: query.periodStart,
        lte: query.periodEnd,
      },
      status: query.status ?? OrderStatus.DELIVERED,
      paymentInstitution: query.paymentInstitution,
      paymentMethod: query.paymentMethod,
      orderPlatformId: query.orderPlatformId,
    };
  }

  private createSummary(orders: ReportOrder[], referenceDate: Date): AggregateBucket {
    return orders.reduce(
      (bucket, order) => addOrderToBucket(bucket, order, referenceDate),
      emptyBucket()
    );
  }

  private createDailySummaries(
    orders: ReportOrder[],
    periodStart: Date,
    periodEnd: Date,
    referenceDate: Date
  ) {
    const buckets = new Map<string, AggregateBucket>();

    orders.forEach((order) => {
      const key = formatLocalDate(order.createdAt);
      buckets.set(key, addOrderToBucket(buckets.get(key) ?? emptyBucket(), order, referenceDate));
    });

    const rows = [];
    let previous: AggregateBucket | null = null;
    const cursor = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      periodStart.getDate(),
      0,
      0,
      0,
      0
    );
    const last = new Date(
      periodEnd.getFullYear(),
      periodEnd.getMonth(),
      periodEnd.getDate(),
      0,
      0,
      0,
      0
    );

    while (cursor <= last) {
      const date = formatLocalDate(cursor);
      const bucket = buckets.get(date) ?? emptyBucket();
      rows.push({
        date,
        ...this.formatAggregate(bucket),
        grossRevenueDeltaRate: previous
          ? calculateDelta(bucket.grossRevenue, previous.grossRevenue)
          : null,
        orderCountDeltaRate: previous
          ? calculateNumberDelta(bucket.orderCount, previous.orderCount)
          : null,
      });
      previous = bucket;
      cursor.setDate(cursor.getDate() + 1);
    }

    return rows;
  }

  private createPaymentDimensionSummary(
    orders: ReportOrder[],
    totalGross: Prisma.Decimal,
    keyResolver: (order: ReportOrder) => string,
    labelResolver: (key: string) => string,
    referenceDate: Date
  ) {
    const buckets = new Map<string, AggregateBucket>();
    orders.forEach((order) => {
      const key = keyResolver(order);
      buckets.set(key, addOrderToBucket(buckets.get(key) ?? emptyBucket(), order, referenceDate));
    });

    return [...buckets.entries()]
      .map(([key, bucket]) => ({
        dimensionKey: key,
        dimensionLabel: labelResolver(key),
        ...this.formatAggregate(bucket),
        shareOfGrossRevenue: totalGross.isZero()
          ? 0
          : bucket.grossRevenue.div(totalGross).toDecimalPlaces(4).toNumber(),
      }))
      .sort((left, right) => Number(right.grossRevenue) - Number(left.grossRevenue));
  }

  private createChannelSummary(orders: ReportOrder[], referenceDate: Date) {
    const buckets = new Map<
      string,
      AggregateBucket & { orderPlatformId: string | null; orderPlatformName: string }
    >();

    orders.forEach((order) => {
      const key = order.orderPlatformId ?? "NO_CHANNEL";
      const current = buckets.get(key) ?? {
        ...emptyBucket(),
        orderPlatformId: order.orderPlatformId,
        orderPlatformName: order.orderPlatform?.name ?? "Sem canal",
      };
      buckets.set(key, {
        ...current,
        ...addOrderToBucket(current, order, referenceDate),
      });
    });

    return [...buckets.values()]
      .map((bucket) => ({
        orderPlatformId: bucket.orderPlatformId,
        orderPlatformName: bucket.orderPlatformName,
        ...this.formatAggregate(bucket),
      }))
      .sort((left, right) => Number(right.grossRevenue) - Number(left.grossRevenue));
  }

  private createAnalyticalPage(
    orders: ReportOrder[],
    total: number,
    page: number,
    pageSize: number,
    referenceDate: Date
  ) {
    const start = (page - 1) * pageSize;
    const pageOrders = orders.slice(start, start + pageSize);

    return {
      page,
      pageSize,
      total,
      items: pageOrders.map((order) => {
        const grossAmount = order.paymentGrossAmount ?? order.total;
        const acquiredNetAmount = order.paymentNetAmount ?? grossAmount;

        return {
          orderId: order.id,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          status: order.status,
          total: toMoneyString(order.total),
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          fulfillmentMethod: order.fulfillmentMethod,
          notes: order.notes,
          orderPlatformId: order.orderPlatformId,
          orderPlatformName: order.orderPlatform?.name ?? null,
          paymentInstitution: order.paymentInstitution,
          paymentMethod: order.paymentMethod,
          externalPaymentId: order.externalPaymentId,
          paymentBrand: order.paymentBrand,
          grossAmount: toMoneyString(grossAmount),
          paymentFeeAmount: order.paymentFeeAmount ? toMoneyString(order.paymentFeeAmount) : null,
          acquiredNetAmount: toMoneyString(acquiredNetAmount),
          paymentReleaseExpectedAt: order.paymentReleaseExpectedAt?.toISOString() ?? null,
          paymentReleaseSource: order.paymentReleaseSource,
          paymentReleaseStatus: isPaymentReleased(order, referenceDate)
            ? "RELEASED"
            : "PENDING_RELEASE",
          itemCount: order.items.reduce((totalItems, item) => totalItems + item.quantity, 0),
          assignedProducts: order.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            productName: item.productNameSnapshot,
            unitPrice: toMoneyString(item.unitPrice),
            total: toMoneyString(item.total),
          })),
          imported: Boolean(order.externalPaymentId),
        };
      }),
    };
  }

  private createReceivablesSummary(orders: ReportOrder[], referenceDate: Date) {
    const pending = orders.filter((order) => !isPaymentReleased(order, referenceDate));
    const nextExpectedReleaseDate = pending
      .map((order) => order.paymentReleaseExpectedAt)
      .filter((date): date is Date => Boolean(date))
      .sort((left, right) => left.getTime() - right.getTime())[0];
    const receivableNetAmount = pending.reduce(
      (totalAmount, order) => totalAmount.add(acquiredNetAmountForOrder(order)),
      new Prisma.Decimal(0)
    );

    return {
      pendingOrderCount: pending.length,
      receivableNetAmount: toMoneyString(receivableNetAmount),
      nextExpectedReleaseDate: nextExpectedReleaseDate
        ? formatLocalDate(nextExpectedReleaseDate)
        : null,
    };
  }

  private formatAggregate(bucket: AggregateBucket) {
    return {
      orderCount: bucket.orderCount,
      grossRevenue: toMoneyString(bucket.grossRevenue),
      acquiredNetRevenue: toMoneyString(bucket.acquiredNetRevenue),
      releasedNetRevenue: toMoneyString(bucket.releasedNetRevenue),
      receivableNetAmount: toMoneyString(bucket.receivableNetAmount),
      paymentFeeAmount: toMoneyString(bucket.paymentFeeAmount),
      averageTicket: toMoneyString(
        bucket.orderCount === 0
          ? new Prisma.Decimal(0)
          : bucket.grossRevenue.div(bucket.orderCount).toDecimalPlaces(2)
      ),
    };
  }
}

function emptyBucket(): AggregateBucket {
  return {
    orderCount: 0,
    grossRevenue: new Prisma.Decimal(0),
    acquiredNetRevenue: new Prisma.Decimal(0),
    releasedNetRevenue: new Prisma.Decimal(0),
    receivableNetAmount: new Prisma.Decimal(0),
    paymentFeeAmount: new Prisma.Decimal(0),
  };
}

function addOrderToBucket(
  bucket: AggregateBucket,
  order: ReportOrder,
  referenceDate: Date
): AggregateBucket {
  const grossAmount = order.paymentGrossAmount ?? order.total;
  const acquiredNetAmount = acquiredNetAmountForOrder(order);
  const released = isPaymentReleased(order, referenceDate);

  return {
    orderCount: bucket.orderCount + 1,
    grossRevenue: bucket.grossRevenue.add(grossAmount),
    acquiredNetRevenue: bucket.acquiredNetRevenue.add(acquiredNetAmount),
    releasedNetRevenue: released
      ? bucket.releasedNetRevenue.add(acquiredNetAmount)
      : bucket.releasedNetRevenue,
    receivableNetAmount: released
      ? bucket.receivableNetAmount
      : bucket.receivableNetAmount.add(acquiredNetAmount),
    paymentFeeAmount: bucket.paymentFeeAmount.add(order.paymentFeeAmount ?? new Prisma.Decimal(0)),
  };
}

function acquiredNetAmountForOrder(order: ReportOrder): Prisma.Decimal {
  return order.paymentNetAmount ?? order.paymentGrossAmount ?? order.total;
}

function isPaymentReleased(order: ReportOrder, referenceDate: Date): boolean {
  return !order.paymentReleaseExpectedAt || order.paymentReleaseExpectedAt <= referenceDate;
}

function calculateDelta(current: Prisma.Decimal, previous: Prisma.Decimal): number | null {
  if (previous.isZero()) {
    return null;
  }

  return current.minus(previous).div(previous).toDecimalPlaces(4).toNumber();
}

function calculateNumberDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }

  return Number(((current - previous) / previous).toFixed(4));
}

function paymentInstitutionLabel(key: string): string {
  const labels: Record<string, string> = {
    PAGBANK: "PagBank",
    MERCADO_PAGO: "Mercado Pago",
    DINHEIRO: "Dinheiro",
    CAIXA_LOCAL: "Caixa local",
    NOT_INFORMED: "Nao informado",
  };
  return labels[key] ?? key;
}

function paymentMethodLabel(key: string): string {
  const labels: Record<string, string> = {
    CASH: "Dinheiro",
    PIX_MANUAL: "Pix manual",
    CARD_ON_DELIVERY: "Cartao na entrega",
    DEBIT_CARD: "Debito",
    CREDIT_CARD: "Credito",
    VOUCHER: "Voucher",
    PIX: "Pix",
    DIGITAL_WALLET: "Carteira digital",
  };
  return labels[key] ?? key;
}
