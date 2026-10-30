import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { FiscalDocument, FiscalDocumentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { maskDocument } from "../configuration/br-documents";
import type {
  FiscalDocumentDetail,
  FiscalDocumentPage,
  FiscalDocumentSummary,
  FiscalPendingReason,
  OrderFiscalInfo,
} from "../fiscal.types";
import { FiscalProviderContextService } from "../providers/fiscal-provider-context.service";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { FiscalDocumentStorageService } from "./fiscal-document-storage.service";

const PENDING_STATUSES: FiscalDocumentStatus[] = ["REJECTED", "ERROR", "CANCEL_PENDING", "CANCEL_FAILED"];

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
        ? { status: { in: PENDING_STATUSES } }
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
  async forOrders(tenantId: string, orders: Array<{ id: string; serviceTabId: string | null; source: string; total: Prisma.Decimal.Value }>) {
    const result = new Map<string, OrderFiscalInfo>();
    if (!orders.length) return result;
    const documents = await this.prisma.fiscalDocument.findMany({
      where: {
        tenantId,
        OR: [
          { orderId: { in: orders.map((order) => order.id) } },
          { serviceTabId: { in: orders.flatMap((order) => (order.serviceTabId ? [order.serviceTabId] : [])) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    for (const order of orders) {
      const document = documents.find((candidate) =>
        order.serviceTabId ? candidate.serviceTabId === order.serviceTabId : candidate.orderId === order.id
      );
      const applicable = ["COUNTER", "IMPORT", "API"].includes(order.source) && new Prisma.Decimal(order.total).greaterThan(0);
      result.set(order.id, {
        status: document ? document.status : applicable ? "NOT_ISSUED" : "NOT_APPLICABLE",
        documentId: document?.id ?? null,
        number: document?.number ?? null,
        accessKey: document?.accessKey ?? null,
        consultationUrl: document?.status === "AUTHORIZED" ? document.consultationUrl : null,
        pendingReason: document ? this.pendingReason(document) : null,
      });
    }
    return result;
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
      pendingReason: this.pendingReason(document),
      providerPanelUrl: document.externalId && adapter ? adapter.panelUrl(document.externalId) : null,
      createdAt: document.createdAt.toISOString(),
    };
  }

  /** A rejected/errored attempt stops being pending once a newer document exists for the sale. */
  private async withoutSuperseded(tenantId: string, documents: DocumentWithTarget[]) {
    const candidates = documents.filter((document) => document.status === "REJECTED" || document.status === "ERROR");
    if (!candidates.length) return documents;
    const newer = await this.prisma.fiscalDocument.findMany({
      where: {
        tenantId,
        status: { notIn: ["REJECTED"] },
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
