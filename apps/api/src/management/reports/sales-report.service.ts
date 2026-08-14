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

interface AggregateRow {
  dimensionKey?: string | null;
  dimensionLabel?: string | null;
  orderCount: bigint | number;
  grossRevenue: Prisma.Decimal;
  acquiredNetRevenue: Prisma.Decimal;
  releasedNetRevenue: Prisma.Decimal;
  receivableNetAmount: Prisma.Decimal;
  paymentFeeAmount: Prisma.Decimal;
  pendingOrderCount?: bigint | number;
  nextExpectedReleaseDate?: Date | null;
}

@Injectable()
export class SalesReportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getReport(tenantId: string, query: ParsedSalesReportQuery) {
    const where = this.buildWhere(tenantId, query);
    const reportReferenceDate = new Date();
    const aggregateWhere = this.buildAggregateWhere(tenantId, query);
    const [summaryRows, dailyRows, institutionRows, methodRows, channelRows, orders, total] =
      await Promise.all([
        this.aggregate(Prisma.sql`SELECT
        COUNT(*)::bigint AS "orderCount",
        COALESCE(SUM(COALESCE(o.payment_gross_amount, o.total)), 0) AS "grossRevenue",
        COALESCE(SUM(COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total)), 0) AS "acquiredNetRevenue",
        COALESCE(SUM(CASE WHEN o.payment_release_expected_at IS NULL OR o.payment_release_expected_at <= ${reportReferenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "releasedNetRevenue",
        COALESCE(SUM(CASE WHEN o.payment_release_expected_at > ${reportReferenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "receivableNetAmount",
        COALESCE(SUM(o.payment_fee_amount), 0) AS "paymentFeeAmount",
        COUNT(*) FILTER (WHERE o.payment_release_expected_at > ${reportReferenceDate})::bigint AS "pendingOrderCount",
        MIN(CASE WHEN o.payment_release_expected_at > ${reportReferenceDate} THEN o.payment_release_expected_at END) AS "nextExpectedReleaseDate"
        FROM orders o WHERE ${aggregateWhere}`),
        this.aggregate(Prisma.sql`SELECT
        TO_CHAR((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS "dimensionKey",
        COUNT(*)::bigint AS "orderCount",
        COALESCE(SUM(COALESCE(o.payment_gross_amount, o.total)), 0) AS "grossRevenue",
        COALESCE(SUM(COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total)), 0) AS "acquiredNetRevenue",
        COALESCE(SUM(CASE WHEN o.payment_release_expected_at IS NULL OR o.payment_release_expected_at <= ${reportReferenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "releasedNetRevenue",
        COALESCE(SUM(CASE WHEN o.payment_release_expected_at > ${reportReferenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "receivableNetAmount",
        COALESCE(SUM(o.payment_fee_amount), 0) AS "paymentFeeAmount"
        FROM orders o WHERE ${aggregateWhere} GROUP BY 1 ORDER BY 1`),
        this.dimensionAggregate(
          aggregateWhere,
          Prisma.sql`COALESCE(o.payment_institution::text, 'NOT_INFORMED')`,
          reportReferenceDate
        ),
        this.dimensionAggregate(
          aggregateWhere,
          Prisma.sql`o.payment_method::text`,
          reportReferenceDate
        ),
        this.aggregate(Prisma.sql`SELECT
        o.order_platform_id::text AS "dimensionKey", COALESCE(p.name, 'Sem canal') AS "dimensionLabel",
        COUNT(*)::bigint AS "orderCount",
        COALESCE(SUM(COALESCE(o.payment_gross_amount, o.total)), 0) AS "grossRevenue",
        COALESCE(SUM(COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total)), 0) AS "acquiredNetRevenue",
        COALESCE(SUM(CASE WHEN o.payment_release_expected_at IS NULL OR o.payment_release_expected_at <= ${reportReferenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "releasedNetRevenue",
        COALESCE(SUM(CASE WHEN o.payment_release_expected_at > ${reportReferenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "receivableNetAmount",
        COALESCE(SUM(o.payment_fee_amount), 0) AS "paymentFeeAmount"
        FROM orders o LEFT JOIN order_platforms p ON p.id = o.order_platform_id
        WHERE ${aggregateWhere} GROUP BY o.order_platform_id, p.name ORDER BY "grossRevenue" DESC`),
        this.prisma.order.findMany({
          where,
          include: {
            items: true,
            orderPlatform: true,
          },
          orderBy: {
            createdAt: "asc",
          },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.order.count({ where }),
      ]);

    const summary = this.rowToBucket(summaryRows[0]);
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
      daily: this.createDailySummaries(dailyRows, query.start, query.end),
      byPaymentInstitution: this.formatDimensionRows(institutionRows, totalGross, (key) =>
        paymentInstitutionLabel(key)
      ),
      byPaymentMethod: this.formatDimensionRows(methodRows, totalGross, (key) =>
        paymentMethodLabel(key)
      ),
      byChannel: channelRows.map((row) => ({
        orderPlatformId: row.dimensionKey,
        orderPlatformName: row.dimensionLabel ?? "Sem canal",
        ...this.formatAggregate(this.rowToBucket(row)),
      })),
      analytical: this.createAnalyticalPage(
        orders,
        total,
        query.page,
        query.pageSize,
        reportReferenceDate
      ),
      receivables: {
        pendingOrderCount: Number(summaryRows[0]?.pendingOrderCount ?? 0),
        receivableNetAmount: toMoneyString(summary.receivableNetAmount),
        nextExpectedReleaseDate: summaryRows[0]?.nextExpectedReleaseDate
          ? formatLocalDate(summaryRows[0].nextExpectedReleaseDate)
          : null,
      },
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

  private buildAggregateWhere(tenantId: string, query: ParsedSalesReportQuery): Prisma.Sql {
    const clauses = [
      Prisma.sql`o.tenant_id = ${tenantId}::uuid`,
      Prisma.sql`o.deleted_at IS NULL`,
      Prisma.sql`o.created_at >= ${query.periodStart}`,
      Prisma.sql`o.created_at <= ${query.periodEnd}`,
      Prisma.sql`o.status::text = ${query.status ?? OrderStatus.DELIVERED}`,
    ];
    if (query.paymentInstitution)
      clauses.push(Prisma.sql`o.payment_institution::text = ${query.paymentInstitution}`);
    if (query.paymentMethod)
      clauses.push(Prisma.sql`o.payment_method::text = ${query.paymentMethod}`);
    if (query.orderPlatformId)
      clauses.push(Prisma.sql`o.order_platform_id = ${query.orderPlatformId}::uuid`);
    return Prisma.join(clauses, " AND ");
  }

  private aggregate(query: Prisma.Sql): Promise<AggregateRow[]> {
    return this.prisma.$queryRaw<AggregateRow[]>(query);
  }

  private dimensionAggregate(
    where: Prisma.Sql,
    dimension: Prisma.Sql,
    referenceDate: Date
  ): Promise<AggregateRow[]> {
    return this.aggregate(Prisma.sql`SELECT
      ${dimension} AS "dimensionKey",
      COUNT(*)::bigint AS "orderCount",
      COALESCE(SUM(COALESCE(o.payment_gross_amount, o.total)), 0) AS "grossRevenue",
      COALESCE(SUM(COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total)), 0) AS "acquiredNetRevenue",
      COALESCE(SUM(CASE WHEN o.payment_release_expected_at IS NULL OR o.payment_release_expected_at <= ${referenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "releasedNetRevenue",
      COALESCE(SUM(CASE WHEN o.payment_release_expected_at > ${referenceDate} THEN COALESCE(o.payment_net_amount, o.payment_gross_amount, o.total) ELSE 0 END), 0) AS "receivableNetAmount",
      COALESCE(SUM(o.payment_fee_amount), 0) AS "paymentFeeAmount"
      FROM orders o WHERE ${where} GROUP BY 1 ORDER BY "grossRevenue" DESC`);
  }

  private createDailySummaries(
    aggregateRows: AggregateRow[],
    periodStart: string,
    periodEnd: string
  ) {
    const buckets = new Map(aggregateRows.map((row) => [row.dimensionKey!, this.rowToBucket(row)]));

    const rows = [];
    let previous: AggregateBucket | null = null;
    const cursor = new Date(`${periodStart}T12:00:00.000Z`);
    const last = new Date(`${periodEnd}T12:00:00.000Z`);

    while (cursor <= last) {
      const date = cursor.toISOString().slice(0, 10);
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
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return rows;
  }

  private formatDimensionRows(
    rows: AggregateRow[],
    totalGross: Prisma.Decimal,
    labelResolver: (key: string) => string
  ) {
    return rows.map((row) => {
      const key = row.dimensionKey ?? "NOT_INFORMED";
      const bucket = this.rowToBucket(row);
      return {
        dimensionKey: key,
        dimensionLabel: labelResolver(key),
        ...this.formatAggregate(bucket),
        shareOfGrossRevenue: totalGross.isZero()
          ? 0
          : bucket.grossRevenue.div(totalGross).toDecimalPlaces(4).toNumber(),
      };
    });
  }

  private createAnalyticalPage(
    orders: ReportOrder[],
    total: number,
    page: number,
    pageSize: number,
    referenceDate: Date
  ) {
    return {
      page,
      pageSize,
      total,
      items: orders.map((order) => {
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

  private rowToBucket(row?: AggregateRow): AggregateBucket {
    if (!row) return emptyBucket();
    return {
      orderCount: Number(row.orderCount),
      grossRevenue: new Prisma.Decimal(row.grossRevenue),
      acquiredNetRevenue: new Prisma.Decimal(row.acquiredNetRevenue),
      releasedNetRevenue: new Prisma.Decimal(row.releasedNetRevenue),
      receivableNetAmount: new Prisma.Decimal(row.receivableNetAmount),
      paymentFeeAmount: new Prisma.Decimal(row.paymentFeeAmount),
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
