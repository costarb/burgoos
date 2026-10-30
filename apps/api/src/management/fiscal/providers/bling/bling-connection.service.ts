import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult, PaymentMethod, Prisma } from "@prisma/client";
import { AuthUser } from "../../../../platform/auth/auth.types";
import { PrismaService } from "../../../../platform/database/prisma.service";
import { AccessAuditService } from "../../../access/access-audit.service";
import { TPAG_BY_METHOD } from "../../documents/nfce-composer";
import { FiscalProviderContextService } from "../fiscal-provider-context.service";
import { BlingClient } from "./bling.client";
import { BlingSettings, PAYMENT_METHOD_LABELS } from "./bling-nfce.mapper";

interface BlingPaymentForm {
  id: number;
  descricao: string;
  tipoPagamento: number;
  situacao: number;
}

interface BlingOperationNature {
  id: number;
  descricao: string;
  padrao: number;
  situacao: number;
}

/** Bling-specific connection settings: operation nature and payment form mapping. */
@Injectable()
export class BlingConnectionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalProviderContextService) private readonly contexts: FiscalProviderContextService,
    @Inject(BlingClient) private readonly client: BlingClient,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  /** Lists the account options and suggests the mapping by NFC-e payment code (tPag). */
  async options(tenantId: string) {
    return this.contexts.run(tenantId, "BLING", "HOMOLOGATION", async (ctx) => {
      const [forms, natures, company] = await Promise.all([
        this.client.get<{ data?: BlingPaymentForm[] }>(tenantId, ctx.accessToken, "/formas-pagamentos?limite=100"),
        this.client.get<{ data?: BlingOperationNature[] }>(tenantId, ctx.accessToken, "/naturezas-operacoes?limite=100"),
        this.client
          .get<{ data?: { cnpj?: string; nome?: string } }>(tenantId, ctx.accessToken, "/empresas/me/dados-basicos")
          .catch(() => ({ data: undefined })),
      ]);
      const paymentForms = (forms?.data ?? [])
        .filter((form) => form.situacao === 1)
        .map((form) => ({ id: String(form.id), name: form.descricao, tPag: String(form.tipoPagamento).padStart(2, "0") }));
      const operationNatures = (natures?.data ?? [])
        .filter((nature) => nature.situacao === 1)
        .map((nature) => ({ id: String(nature.id), name: nature.descricao, defaultForSales: nature.padrao === 1 }));
      const current = (ctx.settings as BlingSettings) ?? {};
      const suggestedPaymentMethodMap = Object.fromEntries(
        (Object.keys(TPAG_BY_METHOD) as PaymentMethod[]).flatMap((method) => {
          const match = paymentForms.find((form) => form.tPag === TPAG_BY_METHOD[method]);
          return match ? [[method, match.id]] : [];
        })
      );
      return {
        paymentForms,
        operationNatures,
        paymentMethods: (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
          .filter((method) => method !== "CARD_ON_DELIVERY")
          .map((method) => ({ method, label: PAYMENT_METHOD_LABELS[method], tPag: TPAG_BY_METHOD[method] })),
        current: {
          naturezaOperacaoId: current.naturezaOperacaoId ? String(current.naturezaOperacaoId) : null,
          paymentMethodMap: current.paymentMethodMap ?? {},
        },
        suggested: {
          naturezaOperacaoId: operationNatures.find((nature) => nature.defaultForSales)?.id ?? null,
          paymentMethodMap: suggestedPaymentMethodMap,
        },
        account: company?.data ? { name: company.data.nome ?? null, cnpj: company.data.cnpj?.replace(/\D/g, "") ?? null } : null,
      };
    });
  }

  async updateSettings(user: AuthUser, settings: { naturezaOperacaoId: string; paymentMethodMap: Record<string, string> }) {
    const connection = await this.prisma.fiscalProviderConnection.findUnique({
      where: { tenantId_provider: { tenantId: user.tenantId, provider: "BLING" } },
    });
    if (!connection) throw new NotFoundException("Conecte a conta Bling primeiro");
    const validMethods = new Set<string>(Object.keys(PAYMENT_METHOD_LABELS));
    const unknown = Object.keys(settings.paymentMethodMap).filter((method) => !validMethods.has(method));
    if (unknown.length) {
      throw new UnprocessableEntityException({ code: "INVALID_PAYMENT_METHOD", message: `Forma de pagamento invalida: ${unknown.join(", ")}` });
    }
    const paymentMethodMap = Object.fromEntries(Object.entries(settings.paymentMethodMap).filter(([, id]) => Boolean(id)));
    const next = {
      ...((connection.settings as Record<string, unknown>) ?? {}),
      naturezaOperacaoId: settings.naturezaOperacaoId,
      paymentMethodMap,
    };
    await this.prisma.fiscalProviderConnection.update({
      where: { id: connection.id },
      data: { settings: next as Prisma.InputJsonValue, updatedByUserId: user.id },
    });
    await this.audit.record({
      actorUserId: user.id,
      storeId: user.tenantId,
      eventType: AccessAuditEventType.FISCAL_CONNECTION_CHANGED,
      result: AccessAuditResult.SUCCESS,
      metadata: { provider: "BLING", action: "settings", naturezaOperacaoId: settings.naturezaOperacaoId, methods: Object.keys(paymentMethodMap) },
    });
    return { naturezaOperacaoId: settings.naturezaOperacaoId, paymentMethodMap };
  }
}
