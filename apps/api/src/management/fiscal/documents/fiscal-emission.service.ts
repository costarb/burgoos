import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { FiscalDocument, Prisma } from "@prisma/client";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { normalizeConsumerDocument } from "../../../common/br/br-documents";
import { FiscalConfigurationService } from "../configuration/fiscal-configuration.service";
import { FiscalIssuerService } from "../configuration/fiscal-issuer.service";
import { FiscalProfileResolver } from "../profiles/fiscal-profile-resolver";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import type { NfceDraft } from "../providers/fiscal-provider.adapter";
import { FiscalAuditService } from "./fiscal-audit.service";
import { evaluateEligibility } from "./fiscal-eligibility";
import { FiscalSaleLoader, FiscalTarget, activeKeyOf } from "./fiscal-sale.loader";
import { composeNfce } from "./nfce-composer";

export interface EmissionRequest {
  tenantId: string;
  target: FiscalTarget;
  trigger: "AUTOMATIC" | "MANUAL";
  actorUserId?: string | null;
  consumerDocument?: string | null;
  confirmRetroactive?: boolean;
}

export type EmissionResult =
  | { status: "QUEUED"; document: FiscalDocument }
  | { status: "MISSING_FISCAL_DATA"; document: FiscalDocument }
  | { status: "SKIPPED"; reason: string };

/**
 * Creates the fiscal document for a sale and queues its emission. The unique `activeKey`
 * guarantees one active NFC-e per sale even with concurrent requests (SC-005).
 */
@Injectable()
export class FiscalEmissionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalConfigurationService) private readonly configurations: FiscalConfigurationService,
    @Inject(FiscalIssuerService) private readonly issuers: FiscalIssuerService,
    @Inject(FiscalProfileResolver) private readonly profiles: FiscalProfileResolver,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(FiscalSaleLoader) private readonly sales: FiscalSaleLoader,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Inject(BackgroundJobService) private readonly jobs: BackgroundJobService
  ) {}

  /** Manual requests throw HTTP errors; automatic requests return SKIPPED instead. */
  async request(input: EmissionRequest): Promise<EmissionResult> {
    const automatic = input.trigger === "AUTOMATIC";
    const skip = (status: number, code: string, message: string, extra: Record<string, unknown> = {}): EmissionResult => {
      if (automatic) return { status: "SKIPPED", reason: code };
      const body = { code, message, ...extra };
      if (status === 404) throw new NotFoundException(body);
      if (status === 422) throw new UnprocessableEntityException(body);
      throw new ConflictException(body);
    };

    const configuration = await this.configurations.current(input.tenantId);
    if (!configuration.enabled || !configuration.provider || !this.registry.has(configuration.provider)) {
      return skip(409, "NOT_READY", "Emissao fiscal desativada ou provedor indisponivel");
    }
    if (automatic && configuration.emissionMode !== "AUTOMATIC") return skip(409, "MANUAL_MODE", "Empresa em modo manual");

    const sale = await this.sales.load(input.tenantId, input.target);
    if (!sale) return skip(404, "NOT_FOUND", "Venda nao encontrada");
    // An order inside a tab is issued as part of the tab's NFC-e.
    if (sale.target.type === "ORDER" && sale.partOfTab) {
      return this.request({ ...input, target: { type: "TAB", id: sale.partOfTab } });
    }
    const eligibility = evaluateEligibility(configuration, sale, {
      trigger: input.trigger,
      confirmRetroactive: input.confirmRetroactive,
    });
    if (!eligibility.eligible) {
      const status = eligibility.reason === "RETROACTIVE_CONFIRMATION_REQUIRED" ? 422 : 409;
      const code = eligibility.reason === "RETROACTIVE_CONFIRMATION_REQUIRED" ? eligibility.reason : "NOT_ELIGIBLE";
      return skip(status, code, eligibility.message, { reason: eligibility.reason });
    }
    if (automatic) {
      // Automatic emission runs once per sale; afterwards only manual reprocessing.
      const existing = await this.prisma.fiscalDocument.count({ where: this.targetWhere(input.tenantId, input.target) });
      if (existing > 0) return { status: "SKIPPED", reason: "ALREADY_ATTEMPTED" };
    }
    const active = await this.prisma.fiscalDocument.findFirst({ where: { activeKey: activeKeyOf(input.target) } });
    if (active) return skip(409, "ALREADY_ISSUED", "Venda ja possui NFC-e ativa", { documentId: active.id });

    let consumerDocument: string | null = null;
    const rawDocument = input.consumerDocument ?? sale.consumerDocument;
    if (rawDocument) {
      consumerDocument = normalizeConsumerDocument(rawDocument);
      if (!consumerDocument) return skip(422, "INVALID_CONSUMER_DOCUMENT", "CPF/CNPJ do consumidor invalido");
    }

    const issuer = await this.issuers.snapshot(input.tenantId);
    if (!issuer) return skip(409, "NOT_READY", "Dados do emitente ou endereco incompletos");

    const complementIds = sale.items.flatMap((item) =>
      item.modifications.map((modification) => modification.complementId).filter((id): id is string => Boolean(id))
    );
    const [productProfiles, complementProfiles] = await Promise.all([
      this.profiles.resolveProducts(input.tenantId, sale.items.map((item) => item.productId)),
      this.profiles.resolveComplements(input.tenantId, complementIds),
    ]);
    const composed = composeNfce({
      items: sale.items,
      total: sale.total,
      payments: sale.payments,
      fallbackPaymentMethod: sale.fallbackPaymentMethod,
      productProfiles,
      complementProfiles,
    });
    const trigger = eligibility.retroactive ? "RETROACTIVE" : input.trigger;
    const base = {
      tenantId: input.tenantId,
      orderId: input.target.type === "ORDER" ? input.target.id : null,
      serviceTabId: input.target.type === "TAB" ? input.target.id : null,
      provider: configuration.provider,
      environment: configuration.environment,
      trigger,
      saleOccurredAt: sale.saleOccurredAt,
      totalAmount: sale.total,
      consumerDocument,
      issuerSnapshot: issuer as unknown as Prisma.InputJsonValue,
      requestedByUserId: input.actorUserId ?? null,
    };

    if (!composed.ok) {
      // Local rejection: never reaches the provider; shows in the pending queue with the missing items.
      const document = await this.prisma.fiscalDocument.create({
        data: {
          ...base,
          status: "REJECTED",
          activeKey: null,
          payloadSnapshot: { missing: composed.missing } as Prisma.InputJsonValue,
          rejectionCode: composed.code,
          rejectionMessage: composed.message.slice(0, 500),
        },
      });
      await this.audit.event({ tenantId: input.tenantId, documentId: document.id, type: "REJECTED", code: composed.code, message: composed.message, actorUserId: input.actorUserId });
      this.audit.log("fiscal.document.rejected", { tenantId: input.tenantId, documentId: document.id, provider: document.provider, code: composed.code }, "warn");
      return { status: "MISSING_FISCAL_DATA", document };
    }

    let document: FiscalDocument;
    try {
      document = await this.prisma.fiscalDocument.create({
        data: { ...base, status: "PENDING", activeKey: activeKeyOf(input.target), payloadSnapshot: {} as Prisma.InputJsonValue },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return skip(409, "ALREADY_ISSUED", "Venda ja possui NFC-e ativa");
      }
      throw error;
    }
    const draft: NfceDraft = {
      reference: document.id,
      environment: configuration.environment,
      issuer,
      consumer: consumerDocument ? { document: consumerDocument } : null,
      items: composed.items,
      payments: composed.payments,
      change: composed.change,
      total: composed.total,
      saleOccurredAt: sale.saleOccurredAt.toISOString(),
      additionalInfo: sale.publicCode ? `Pedido ${sale.publicCode}` : null,
    };
    document = await this.prisma.fiscalDocument.update({
      where: { id: document.id },
      data: { payloadSnapshot: draft as unknown as Prisma.InputJsonValue },
    });
    await this.audit.event({
      tenantId: input.tenantId,
      documentId: document.id,
      type: "CREATED",
      actorUserId: input.actorUserId,
      metadata: { trigger, target: input.target, items: composed.items.length, adjustment: composed.adjustment },
    });
    if (eligibility.retroactive) {
      await this.audit.event({ tenantId: input.tenantId, documentId: document.id, type: "RETROACTIVE_CONFIRMED", actorUserId: input.actorUserId });
    }
    await this.enqueue(document);
    this.audit.log("fiscal.document.submitted", { tenantId: input.tenantId, documentId: document.id, provider: document.provider, target: input.target, trigger });
    return { status: "QUEUED", document };
  }

  async enqueue(document: FiscalDocument): Promise<void> {
    await this.jobs.enqueue({
      tenantId: document.tenantId,
      type: "FISCAL_EMISSION",
      priority: "HIGH",
      targetType: "FISCAL_DOCUMENT",
      targetId: document.id,
      dedupeKey: `emit:${document.id}`,
      maxAttempts: 6,
    });
  }

  private targetWhere(tenantId: string, target: FiscalTarget) {
    return target.type === "ORDER" ? { tenantId, orderId: target.id } : { tenantId, serviceTabId: target.id };
  }
}
