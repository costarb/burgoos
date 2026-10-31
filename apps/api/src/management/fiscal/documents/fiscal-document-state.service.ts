import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type FiscalDocument } from "@prisma/client";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { FiscalProviderContextService } from "../providers/fiscal-provider-context.service";
import type { NfceDraft, ProviderDocumentState } from "../providers/fiscal-provider.adapter";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FiscalAuditService } from "./fiscal-audit.service";
import { FiscalDocumentStorageService } from "./fiscal-document-storage.service";
import { authorizedItemTaxes, compareItemTaxes } from "./fiscal-tax-divergence";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Sync cadence by document age: every minute in the first hour, 15 min up to a day, hourly up to 7 days. */
export function nextSyncAt(createdAt: Date, now = new Date()): Date | null {
  const age = now.getTime() - createdAt.getTime();
  if (age < HOUR) return new Date(now.getTime() + MINUTE);
  if (age < DAY) return new Date(now.getTime() + 15 * MINUTE);
  if (age < 7 * DAY) return new Date(now.getTime() + HOUR);
  return null;
}

export type StateOutcome = "AUTHORIZED" | "PROCESSING" | "REJECTED" | "CANCELLED" | "UNCHANGED";

/** Applies a provider state to a document (shared by emission, sync and cancellation). */
@Injectable()
export class FiscalDocumentStateService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Inject(FiscalDocumentStorageService) private readonly storage: FiscalDocumentStorageService,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(FiscalProviderContextService) private readonly contexts: FiscalProviderContextService
  ) {}

  async apply(document: FiscalDocument, state: ProviderDocumentState, via: "EMISSION" | "SYNC" | "CANCELLATION"): Promise<StateOutcome> {
    const now = new Date();
    if (state.status === "PROCESSING") {
      if (document.status === "PENDING" || document.status === "ERROR") {
        await this.prisma.fiscalDocument.update({
          where: { id: document.id },
          data: { status: "PROCESSING", externalId: state.externalId, nextSyncAt: nextSyncAt(document.createdAt, now) },
        });
      } else {
        await this.prisma.fiscalDocument.update({
          where: { id: document.id },
          data: { nextSyncAt: nextSyncAt(document.createdAt, now) },
        });
      }
      return "PROCESSING";
    }

    if (state.status === "REJECTED") {
      if (!["PENDING", "PROCESSING", "ERROR"].includes(document.status)) return "UNCHANGED";
      await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: {
          status: "REJECTED",
          activeKey: null,
          externalId: state.externalId ?? document.externalId,
          rejectionCode: state.code.slice(0, 40),
          rejectionMessage: state.message.slice(0, 500),
          nextSyncAt: null,
        },
      });
      await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "REJECTED", code: state.code, message: state.message });
      this.audit.log("fiscal.document.rejected", { tenantId: document.tenantId, documentId: document.id, provider: document.provider, code: state.code }, "warn");
      return "REJECTED";
    }

    if (state.status === "AUTHORIZED") {
      if (!["PENDING", "PROCESSING", "ERROR"].includes(document.status)) return "UNCHANGED";
      const authorizedAt = state.authorizedAt ? new Date(state.authorizedAt) : now;
      const updated = await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: {
          status: "AUTHORIZED",
          externalId: state.externalId,
          number: state.number,
          series: state.series,
          accessKey: state.accessKey,
          protocol: state.protocol,
          issuedAt: document.issuedAt ?? authorizedAt,
          authorizedAt,
          qrCodeUrl: state.qrCodeUrl,
          consultationUrl: state.consultationUrl,
          danfeUrl: state.danfeUrl,
          rejectionCode: null,
          rejectionMessage: null,
          nextSyncAt: null,
        },
      });
      await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "AUTHORIZED", providerStatus: "AUTHORIZED", metadata: { via, number: state.number } });
      this.audit.log("fiscal.document.authorized", {
        tenantId: document.tenantId,
        documentId: document.id,
        provider: document.provider,
        trigger: document.trigger,
        saleToAuthorizationSeconds: Math.round((authorizedAt.getTime() - document.saleOccurredAt.getTime()) / 1000),
      });
      await this.storeFiles(updated as FiscalDocument, "AUTHORIZATION");
      return "AUTHORIZED";
    }

    // CANCELLED at the provider (API cancellation or done directly in the provider panel).
    if (document.status === "CANCELLED") return "UNCHANGED";
    const cancelledAt = state.cancelledAt ? new Date(state.cancelledAt) : now;
    const updated = await this.prisma.fiscalDocument.update({
      where: { id: document.id },
      data: { status: "CANCELLED", activeKey: null, cancelledAt, cancelProtocol: state.protocol, nextSyncAt: null },
    });
    await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "CANCELLED", providerStatus: "CANCELLED", metadata: { via } });
    this.audit.log("fiscal.document.cancelled", {
      tenantId: document.tenantId,
      documentId: document.id,
      provider: document.provider,
      via: via === "CANCELLATION" ? "API" : "PROVIDER_PANEL",
    });
    await this.storeFiles(updated as FiscalDocument, "CANCELLATION");
    return "CANCELLED";
  }

  /** Best effort: a storage or download failure never reverts the fiscal status. */
  async storeFiles(document: FiscalDocument, kind: "AUTHORIZATION" | "CANCELLATION"): Promise<void> {
    if (!document.externalId) return;
    const adapter = this.registry.get(document.provider);
    const name = document.accessKey ?? document.id;
    const issuedAt = document.issuedAt ?? document.createdAt;
    let authorizedXml = null as Buffer | null;
    try {
      const data: Record<string, string> = {};
      await this.contexts.run(document.tenantId, document.provider, document.environment, async (ctx) => {
        const xml = await adapter.downloadXml(ctx, document.externalId as string, kind);
        if (xml) {
          if (kind === "AUTHORIZATION") authorizedXml = xml;
          const key = this.storage.key(document.tenantId, issuedAt, name, kind === "AUTHORIZATION" ? "xml" : "cancel-xml");
          data[kind === "AUTHORIZATION" ? "xmlAssetKey" : "cancelXmlAssetKey"] = await this.storage.save(key, xml, "xml");
        }
        if (kind === "AUTHORIZATION") {
          const pdf = await adapter.downloadDanfe(ctx, document.externalId as string);
          if (pdf) data.danfeAssetKey = await this.storage.save(this.storage.key(document.tenantId, issuedAt, name, "danfe"), pdf, "danfe");
        }
      });
      if (Object.keys(data).length) {
        await this.prisma.fiscalDocument.update({ where: { id: document.id }, data });
        await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "DOCUMENTS_STORED", metadata: { kind, files: Object.keys(data) } });
      }
    } catch (error) {
      this.audit.log(
        "fiscal.document.storage_failed",
        { tenantId: document.tenantId, documentId: document.id, kind, reason: (error as Error).message },
        "warn"
      );
    }
    if (authorizedXml) await this.checkItemTaxes(document, authorizedXml);
  }

  /**
   * Compares the CFOP/CSOSN authorized for each item with the fiscal profile sent by the ERP. Providers
   * that apply their own tax rules (Bling operation nature) may diverge silently; the divergence becomes
   * a pending item to review the provider configuration. Never changes the fiscal status.
   */
  async checkItemTaxes(document: FiscalDocument, xml: Buffer): Promise<void> {
    const draft = document.payloadSnapshot as unknown as Partial<NfceDraft> | null;
    if (!draft?.items?.length) return;
    const divergences = compareItemTaxes(draft.items, authorizedItemTaxes(xml.toString("utf8")));
    if (!divergences.length) return;
    await this.prisma.fiscalDocument.update({
      where: { id: document.id },
      data: {
        taxDivergences: divergences as unknown as Prisma.InputJsonValue,
        taxDivergenceAt: new Date(),
        taxDivergenceReviewedAt: null,
      },
    });
    const message = divergences
      .map((item) => `${item.description}: autorizado ${item.actual.cfop ?? "-"}/${item.actual.csosn ?? "-"}, perfil ${item.expected.cfop}/${item.expected.csosn}`)
      .join("; ");
    await this.audit.event({
      tenantId: document.tenantId,
      documentId: document.id,
      type: "TAX_DIVERGENCE",
      code: "TAX_DIVERGENCE",
      message,
      metadata: { items: divergences.length },
    });
    this.audit.log(
      "fiscal.document.tax_divergence",
      {
        tenantId: document.tenantId,
        documentId: document.id,
        provider: document.provider,
        items: divergences.map((item) => ({ ncm: item.ncm, expected: item.expected, actual: item.actual })),
      },
      "warn"
    );
  }
}
