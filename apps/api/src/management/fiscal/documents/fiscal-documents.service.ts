import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { FiscalDocument, FiscalDocumentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { maskDocument } from "../../../common/br/br-documents";
import type {
  FiscalDocumentDetail,
  FiscalDocumentPage,
  FiscalDocumentSummary,
  FiscalPendingReason,
  FiscalTaxDivergence,
  OrderFiscalInfo,
} from "../fiscal.types";
import { FiscalProviderContextService } from "../providers/fiscal-provider-context.service";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { FiscalDocumentStorageService } from "./fiscal-document-storage.service";

const PENDING_STATUSES: FiscalDocumentStatus[] = ["REJECTED", "ERROR", "CANCEL_PENDING", "CANCEL_FAILED"];
/** Authorized notes whose item taxes diverged from the fiscal profile and nobody reviewed yet. */
const UNREVIEWED_TAX_DIVERGENCE: Prisma.FiscalDocumentWhereInput = {
  status: "AUTHORIZED",
  taxDivergenceAt: { not: null },
  taxDivergenceReviewedAt: null,
};

export interface UnissuedSale {
  target: { type: "ORDER" | "TAB"; id: string };
  publicCode: string | null;
  source: string;
  totalAmount: string;
  saleOccurredAt: string;
  paymentMethods: string[];
  /** Status of the latest attempt (e.g. REJECTED), null when never attempted. */
  lastAttempt: FiscalDocumentStatus | null;
}

export interface FiscalDocumentFilters {
  status?: FiscalDocumentStatus[];
  from?: Date;
  to?: Date;
  orderId?: string;
  serviceTabId?: string;
  pendingOnly?: boolean;
  page?: number;
  pageSize?: number;
}

type DocumentWithTarget = FiscalDocument & {
  order?: { publicCode: string | null } | null;
  serviceTab?: { publicCode: string } | null;
};

@Injectable()
export class FiscalDocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(FiscalProviderContextService) private readonly contexts: FiscalProviderContextService,
    @Inject(FiscalDocumentStorageService) private readonly storage: FiscalDocumentStorageService
  ) {}

  async list(tenantId: string, filters: FiscalDocumentFilters): Promise<FiscalDocumentPage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
    const where: Prisma.FiscalDocumentWhereInput = {
      tenantId,
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
      ...(filters.serviceTabId ? { serviceTabId: filters.serviceTabId } : {}),
      ...(filters.from || filters.to
        ? { saleOccurredAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
      ...(filters.pendingOnly
        ? { OR: [{ status: { in: PENDING_STATUSES } }, UNREVIEWED_TAX_DIVERGENCE] }
        : filters.status?.length
          ? { status: { in: filters.status } }
          : {}),
    };
    let documents = (await this.prisma.fiscalDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { order: { select: { publicCode: true } }, serviceTab: { select: { publicCode: true } } },
    })) as DocumentWithTarget[];
    if (filters.pendingOnly) documents = await this.withoutSuperseded(tenantId, documents);
    const total = documents.length;
    const items = documents.slice((page - 1) * pageSize, page * pageSize).map((document) => this.summary(document));
    return { items, page, pageSize, total };
  }

  async detail(tenantId: string, id: string): Promise<FiscalDocumentDetail> {
    const document = (await this.prisma.fiscalDocument.findFirst({
      where: { id, tenantId },
      include: {
        order: { select: { publicCode: true } },
        serviceTab: { select: { publicCode: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    })) as (DocumentWithTarget & { events: Array<{ type: string; code: string | null; message: string | null; actorUserId: string | null; createdAt: Date }> }) | null;
    if (!document) throw new NotFoundException("NFC-e nao encontrada");
    return {
      ...this.summary(document),
      consumerDocumentMasked: maskDocument(document.consumerDocument),
      qrCodeUrl: document.qrCodeUrl,
      consultationUrl: document.consultationUrl,
      hasXml: Boolean(document.xmlAssetKey || document.externalId),
      hasDanfe: Boolean(document.danfeAssetKey || document.danfeUrl || document.externalId),
      cancelReason: document.cancelReason,
      cancelledAt: document.cancelledAt?.toISOString() ?? null,
      events: [...document.events]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((event) => ({
          type: event.type,
          code: event.code,
          message: event.message,
          actorUserId: event.actorUserId,
          createdAt: event.createdAt.toISOString(),
        })),
    };
  }

  async require(tenantId: string, id: string): Promise<FiscalDocument> {
    const document = await this.prisma.fiscalDocument.findFirst({ where: { id, tenantId } });
    if (!document) throw new NotFoundException("NFC-e nao encontrada");
    return document;
  }

  /** Fiscal status for a set of orders (the order's own document or its tab's, latest first). */
  /**
   * Fiscal status per order plus whether the manual emission is allowed now: NFC-e not issued
   * (or rejected), emission enabled and the sale paid. Orders of a tab point to the tab, which is
   * issued as a whole once it is paid.
   */
  async forOrders(tenantId: string, orders: Array<{ id: string; serviceTabId: string | null; source: string; total: Prisma.Decimal.Value }>) {
    const result = new Map<string, OrderFiscalInfo>();
    if (!orders.length) return result;
    const orderIds = orders.map((order) => order.id);
    const tabIds = [...new Set(orders.flatMap((order) => (order.serviceTabId ? [order.serviceTabId] : [])))];
    const validPayment = { payment: { cancelledAt: null, refundedAt: null } };
    const [documents, configuration, orderRows, tabRows] = await Promise.all([
      this.prisma.fiscalDocument.findMany({
        where: { tenantId, OR: [{ orderId: { in: orderIds } }, { serviceTabId: { in: tabIds } }] },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.fiscalConfiguration.findUnique({ where: { tenantId }, select: { enabled: true, eligibleSources: true } }),
      this.prisma.order.findMany({
        where: { tenantId, id: { in: orderIds } },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          paymentInstitution: true,
          paymentAllocations: { where: validPayment, select: { amount: true } },
        },
      }),
      tabIds.length
        ? this.prisma.serviceTab.findMany({
            where: { tenantId, id: { in: tabIds } },
            select: {
              id: true,
              status: true,
              publicCode: true,
              paymentAllocations: { where: validPayment, select: { amount: true } },
              orders: {
                where: { deletedAt: null, status: { not: "CANCELLED" } },
                select: { total: true, paymentAllocations: { where: validPayment, select: { amount: true } } },
              },
            },
          })
        : Promise.resolve([]),
    ]);
    const sum = (values: Array<{ amount: Prisma.Decimal.Value }>) =>
      values.reduce((total, value) => total.add(new Prisma.Decimal(value.amount)), new Prisma.Decimal(0));
    const sources = configuration?.eligibleSources ?? ["COUNTER", "IMPORT", "API"];

    for (const order of orders) {
      const row = orderRows.find((candidate) => candidate.id === order.id);
      const tab = order.serviceTabId ? tabRows.find((candidate) => candidate.id === order.serviceTabId) : undefined;
      const document = documents.find((candidate) =>
        order.serviceTabId ? candidate.serviceTabId === order.serviceTabId : candidate.orderId === order.id
      );
      const total = new Prisma.Decimal(order.total);
      const applicable =
        ["COUNTER", "IMPORT", "API"].includes(order.source) &&
        sources.includes(order.source as never) &&
        total.greaterThan(0) &&
        row?.paymentInstitution !== "IFOOD";
      const status = document ? document.status : applicable ? "NOT_ISSUED" : "NOT_APPLICABLE";

      let blockedReason: OrderFiscalInfo["blockedReason"] = null;
      if (status !== "NOT_ISSUED" && status !== "REJECTED") blockedReason = null;
      else if (!configuration?.enabled) blockedReason = "DISABLED";
      else if (row?.deletedAt || row?.status === "CANCELLED" || tab?.status === "CANCELLED") blockedReason = "CANCELLED";
      else if (tab) {
        const tabTotal = tab.orders.reduce((value, item) => value.add(new Prisma.Decimal(item.total)), new Prisma.Decimal(0));
        const tabPaid = sum(tab.paymentAllocations).add(sum(tab.orders.flatMap((item) => item.paymentAllocations)));
        if (!(tab.status === "PAID" || (tabTotal.greaterThan(0) && tabPaid.greaterThanOrEqualTo(tabTotal)))) blockedReason = "TAB_NOT_PAID";
      } else if (order.source === "COUNTER" && sum(row?.paymentAllocations ?? []).lessThan(total)) {
        blockedReason = "NOT_PAID";
      }
      const canEmit = (status === "NOT_ISSUED" || status === "REJECTED") && blockedReason === null;

      result.set(order.id, {
        status,
        documentId: document?.id ?? null,
        number: document?.number ?? null,
        accessKey: document?.accessKey ?? null,
        consultationUrl: document?.status === "AUTHORIZED" ? document.consultationUrl : null,
        pendingReason: document ? this.pendingReason(document) : null,
        canEmit,
        blockedReason,
        target: order.serviceTabId ? { type: "TAB", id: order.serviceTabId } : { type: "ORDER", id: order.id },
        targetCode: tab?.publicCode ?? null,
      });
    }
    return result;
  }

  /**
   * Paid sales of a business day without an active NFC-e (pending reason SAME_DAY_NOT_ISSUED):
   * counter/imported orders outside tabs, and paid tabs. Used for manual emission.
   */
  async unissued(tenantId: string, day: string): Promise<UnissuedSale[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new NotFoundException("Data invalida");
    const start = new Date(`${day}T00:00:00-03:00`);
    const end = new Date(`${day}T23:59:59.999-03:00`);
    const configuration = await this.prisma.fiscalConfiguration.findUnique({ where: { tenantId }, select: { eligibleSources: true } });
    const sources = (configuration?.eligibleSources ?? ["COUNTER", "IMPORT", "API"]).filter((source) => ["COUNTER", "IMPORT", "API"].includes(source));
    const noActiveDocument = { fiscalDocuments: { none: { activeKey: { not: null } } } };
    const [orders, tabs] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId,
          serviceTabId: null,
          deletedAt: null,
          status: { not: "CANCELLED" },
          source: { in: sources },
          // Marketplace (iFood) sales are out of scope; NULL must be kept explicitly (SQL `<>` drops it).
          OR: [{ paymentInstitution: null }, { paymentInstitution: { not: "IFOOD" } }],
          createdAt: { gte: start, lte: end },
          total: { gt: 0 },
          ...noActiveDocument,
        },
        include: {
          paymentAllocations: { include: { payment: { select: { method: true, cancelledAt: true, refundedAt: true } } } },
          fiscalDocuments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      sources.includes("COUNTER")
        ? this.prisma.serviceTab.findMany({
            where: { tenantId, status: "PAID", closedAt: { gte: start, lte: end }, ...noActiveDocument },
            include: {
              orders: { where: { deletedAt: null, status: { not: "CANCELLED" } }, select: { total: true } },
              fiscalDocuments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
            },
            orderBy: { closedAt: "desc" },
            take: 200,
          })
        : Promise.resolve([]),
    ]);
    const result: UnissuedSale[] = [];
    for (const order of orders) {
      const payments = order.paymentAllocations.filter((allocation) => allocation.payment && !allocation.payment.cancelledAt && !allocation.payment.refundedAt);
      const paid = payments.reduce((sum, allocation) => sum.add(allocation.amount), new Prisma.Decimal(0));
      // Counter sales need the full balance paid; imports and API orders are paid on creation.
      if (order.source === "COUNTER" && paid.lessThan(order.total)) continue;
      result.push({
        target: { type: "ORDER", id: order.id },
        publicCode: order.publicCode,
        source: order.source,
        totalAmount: new Prisma.Decimal(order.total).toFixed(2),
        saleOccurredAt: order.createdAt.toISOString(),
        paymentMethods: [...new Set(payments.length ? payments.map((allocation) => allocation.payment!.method) : [order.paymentMethod])],
        lastAttempt: order.fiscalDocuments[0]?.status ?? null,
      });
    }
    for (const tab of tabs) {
      const total = tab.orders.reduce((sum, order) => sum.add(order.total), new Prisma.Decimal(0));
      if (total.lessThanOrEqualTo(0)) continue;
      result.push({
        target: { type: "TAB", id: tab.id },
        publicCode: tab.publicCode,
        source: "COUNTER",
        totalAmount: total.toFixed(2),
        saleOccurredAt: (tab.closedAt ?? tab.openedAt).toISOString(),
        paymentMethods: [],
        lastAttempt: tab.fiscalDocuments[0]?.status ?? null,
      });
    }
    return result.sort((a, b) => b.saleOccurredAt.localeCompare(a.saleOccurredAt));
  }

  /** Fiscal status keyed by order id, for the orders list (ids of other tenants are ignored). */
  async statusByOrderIds(tenantId: string, ids: string[]): Promise<Record<string, OrderFiscalInfo>> {
    const unique = [...new Set(ids)].slice(0, 200);
    if (!unique.length) return {};
    const orders = await this.prisma.order.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, serviceTabId: true, source: true, total: true },
    });
    return Object.fromEntries(await this.forOrders(tenantId, orders));
  }

  /** XML/DANFE from the ERP storage; downloads from the provider (and keeps a copy) when missing. */
  async file(
    tenantId: string,
    id: string,
    kind: "xml" | "danfe"
  ): Promise<{ content: Buffer; contentType: string; fileName: string } | { redirect: string }> {
    const document = await this.require(tenantId, id);
    // Providers whose DANFE is a hosted print page (Bling) are served by redirect.
    if (kind === "danfe" && !document.danfeAssetKey && document.danfeUrl) return { redirect: document.danfeUrl };
    const key = kind === "xml" ? document.xmlAssetKey : document.danfeAssetKey;
    const name = document.accessKey ?? document.id;
    const contentType = kind === "xml" ? "application/xml" : "application/pdf";
    const fileName = `NFCe-${name}.${kind === "xml" ? "xml" : "pdf"}`;
    if (key) return { content: await this.storage.read(key), contentType, fileName };
    if (!document.externalId) throw new NotFoundException("Arquivo indisponivel");
    const adapter = this.registry.get(document.provider);
    const content = await this.contexts.run(document.tenantId, document.provider, document.environment, (ctx) =>
      kind === "xml" ? adapter.downloadXml(ctx, document.externalId as string, "AUTHORIZATION") : adapter.downloadDanfe(ctx, document.externalId as string)
    );
    if (!content) throw new NotFoundException("Arquivo indisponivel no provedor");
    const storageKey = this.storage.key(document.tenantId, document.issuedAt ?? document.createdAt, name, kind);
    await this.storage.save(storageKey, content, kind);
    await this.prisma.fiscalDocument.update({
      where: { id: document.id },
      data: kind === "xml" ? { xmlAssetKey: storageKey } : { danfeAssetKey: storageKey },
    });
    return { content, contentType, fileName };
  }

  /** "Revisado": the provider configuration was checked; the divergence leaves the pending list. */
  async reviewTaxDivergence(tenantId: string, id: string, actorUserId: string): Promise<FiscalDocumentDetail> {
    const document = await this.require(tenantId, id);
    if (!document.taxDivergenceAt) throw new ConflictException({ code: "NO_TAX_DIVERGENCE", message: "NFC-e sem divergencia de tributacao" });
    if (!document.taxDivergenceReviewedAt) {
      await this.prisma.$transaction(async (tx) => {
        await tx.fiscalDocument.update({ where: { id }, data: { taxDivergenceReviewedAt: new Date() } });
        await tx.fiscalDocumentEvent.create({
          data: { tenantId, documentId: id, type: "TAX_DIVERGENCE_REVIEWED", actorUserId, metadata: {} },
        });
      });
    }
    return this.detail(tenantId, id);
  }

  pendingReason(document: FiscalDocument): FiscalPendingReason | null {
    switch (document.status) {
      case "REJECTED":
        return document.rejectionCode === "MISSING_FISCAL_DATA" ? "MISSING_FISCAL_DATA" : "REJECTED";
      case "ERROR":
        return document.rejectionCode === "PROVIDER_DISCONNECTED" ? "PROVIDER_DISCONNECTED" : "ERROR";
      case "CANCEL_PENDING": {
        const adapter = this.registry.has(document.provider) ? this.registry.get(document.provider) : null;
        return adapter?.capabilities.cancelViaApi ? null : "CANCEL_MANUAL_REQUIRED";
      }
      case "CANCEL_FAILED":
        return "CANCEL_FAILED";
      case "AUTHORIZED":
        return document.taxDivergenceAt && !document.taxDivergenceReviewedAt ? "TAX_DIVERGENCE" : null;
      default:
        return null;
    }
  }

  summary(document: DocumentWithTarget): FiscalDocumentSummary {
    const adapter = this.registry.has(document.provider) ? this.registry.get(document.provider) : null;
    return {
      id: document.id,
      target: document.orderId
        ? { type: "ORDER", id: document.orderId, publicCode: document.order?.publicCode ?? null }
        : { type: "TAB", id: document.serviceTabId as string, publicCode: document.serviceTab?.publicCode ?? null },
      status: document.status,
      trigger: document.trigger as FiscalDocumentSummary["trigger"],
      environment: document.environment,
      number: document.number,
      series: document.series,
      accessKey: document.accessKey,
      totalAmount: new Prisma.Decimal(document.totalAmount).toFixed(2),
      saleOccurredAt: document.saleOccurredAt.toISOString(),
      authorizedAt: document.authorizedAt?.toISOString() ?? null,
      rejectionCode: document.rejectionCode,
      rejectionMessage: document.rejectionMessage,
      cancelDeadlineAt: document.cancelDeadlineAt?.toISOString() ?? null,
      taxDivergences: (document.taxDivergences as unknown as FiscalTaxDivergence[] | null) ?? null,
      taxDivergenceReviewedAt: document.taxDivergenceReviewedAt?.toISOString() ?? null,
      pendingReason: this.pendingReason(document),
      providerPanelUrl: document.externalId && adapter ? adapter.panelUrl(document.externalId) : null,
      createdAt: document.createdAt.toISOString(),
    };
  }

  /** A rejected/errored attempt stops being pending once a newer attempt (of any status) exists for the sale. */
  private async withoutSuperseded(tenantId: string, documents: DocumentWithTarget[]) {
    const candidates = documents.filter((document) => document.status === "REJECTED" || document.status === "ERROR");
    if (!candidates.length) return documents;
    const newer = await this.prisma.fiscalDocument.findMany({
      where: {
        tenantId,
        OR: [
          { orderId: { in: candidates.flatMap((document) => (document.orderId ? [document.orderId] : [])) } },
          { serviceTabId: { in: candidates.flatMap((document) => (document.serviceTabId ? [document.serviceTabId] : [])) } },
        ],
      },
      select: { id: true, orderId: true, serviceTabId: true, createdAt: true },
    });
    return documents.filter((document) => {
      if (document.status !== "REJECTED" && document.status !== "ERROR") return true;
      return !newer.some(
        (other) =>
          other.id !== document.id &&
          other.createdAt > document.createdAt &&
          (document.orderId ? other.orderId === document.orderId : other.serviceTabId === document.serviceTabId)
      );
    });
  }
}
