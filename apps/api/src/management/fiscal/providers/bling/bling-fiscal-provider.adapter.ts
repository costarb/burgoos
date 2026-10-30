import { Inject, Injectable } from "@nestjs/common";
import {
  FiscalProviderAdapter,
  FiscalProviderError,
  FiscalSettingsIssue,
  NfceDraft,
  ProviderContext,
  ProviderDocumentState,
} from "../fiscal-provider.adapter";
import { BlingClient } from "./bling.client";
import {
  BlingNfceDetail,
  BlingSettings,
  PAYMENT_METHOD_LABELS,
  REQUIRED_PAYMENT_METHODS,
  blingDateTime,
  parseAuthorizedXml,
  parseSendResult,
  stateFromDetail,
  toBlingNfce,
} from "./bling-nfce.mapper";

const LOOKUP_WINDOW_MS = 30 * 60_000;

/**
 * Bling API v3 NFC-e adapter (research R1). Two steps: create (Bling assigns number/series) and
 * send to SEFAZ (synchronous SEFAZ answer). No public cancellation endpoint: `cancelViaApi=false`
 * keeps the assisted flow. DANFE is an HTML page (linkDanfe), so only the XML is downloaded.
 */
@Injectable()
export class BlingFiscalProviderAdapter implements FiscalProviderAdapter {
  readonly provider = "BLING" as const;
  readonly capabilities = { cancelViaApi: false, usesOwnCertificate: false };

  constructor(@Inject(BlingClient) private readonly client: BlingClient) {}

  async create(ctx: ProviderContext, draft: NfceDraft): Promise<{ externalId: string }> {
    const payload = toBlingNfce(draft, ctx.settings as BlingSettings);
    const response = await this.client.post<{ data?: { id?: number } }>(ctx.tenantId, ctx.accessToken, "/nfce", payload);
    const id = response?.data?.id;
    if (!id) throw new FiscalProviderError("INCOMPATIBLE_RESPONSE", "Bling nao devolveu o id da NFC-e", true);
    return { externalId: String(id) };
  }

  async submit(ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState> {
    const response = await this.client.post<unknown>(ctx.tenantId, ctx.accessToken, `/nfce/${encodeURIComponent(externalId)}/enviar`);
    const result = parseSendResult(externalId, response);
    if (result.status !== "AUTHORIZED") return result;
    // Number, series, DANFE link and QR code come from the document itself.
    const detailed = await this.get(ctx, externalId);
    if (detailed.status !== "AUTHORIZED") return result;
    return {
      ...detailed,
      accessKey: detailed.accessKey ?? result.accessKey,
      protocol: result.protocol ?? detailed.protocol,
      authorizedAt: result.authorizedAt ?? detailed.authorizedAt,
    };
  }

  async get(ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState> {
    const detail = await this.detail(ctx, externalId);
    if (![5, 6, 7].includes(detail.situacao) || !detail.xml) return stateFromDetail(detail);
    try {
      const xml = (await this.client.download(detail.xml)).toString("utf8");
      return stateFromDetail(detail, parseAuthorizedXml(xml));
    } catch {
      return stateFromDetail(detail);
    }
  }

  /** After a timeout on create: same total and item codes, created within the last 30 minutes. */
  async findByReference(ctx: ProviderContext, draft: NfceDraft): Promise<{ externalId: string } | null> {
    const now = new Date();
    const query = new URLSearchParams({
      pagina: "1",
      limite: "100",
      dataEmissaoInicial: blingDateTime(new Date(now.getTime() - LOOKUP_WINDOW_MS)),
      dataEmissaoFinal: blingDateTime(new Date(now.getTime() + 5 * 60_000)),
    });
    const list = await this.client.get<{ data?: Array<{ id: number; valorNota?: number }> }>(
      ctx.tenantId,
      ctx.accessToken,
      `/nfce?${query.toString()}`
    );
    const total = Number(draft.total);
    const codes = draft.items.map((item) => item.code.slice(0, 60)).sort().join("|");
    // The list has no total: compare total and item codes on each candidate's detail.
    for (const candidate of list?.data ?? []) {
      if (candidate.valorNota !== undefined && Math.abs(Number(candidate.valorNota) - total) > 0.005) continue;
      const detail = await this.detail(ctx, String(candidate.id));
      if (detail.valorNota !== undefined && Math.abs(Number(detail.valorNota) - total) > 0.005) continue;
      const candidateCodes = (detail.itens ?? []).map((item) => item.codigo ?? "").sort().join("|");
      if (candidateCodes === codes) return { externalId: String(candidate.id) };
    }
    return null;
  }

  async downloadXml(ctx: ProviderContext, externalId: string, kind: "AUTHORIZATION" | "CANCELLATION"): Promise<Buffer | null> {
    const detail = await this.detail(ctx, externalId);
    if (!detail.xml) return null;
    // The Bling XML link returns the current document; for a cancelled note it carries the event.
    if (kind === "CANCELLATION" && detail.situacao !== 2) return null;
    return this.client.download(detail.xml);
  }

  async downloadDanfe(): Promise<Buffer | null> {
    return null;
  }

  panelUrl(): string | null {
    return "https://www.bling.com.br/notas.fiscais.consumidor.php";
  }

  validateSettings(settings: Record<string, unknown>): FiscalSettingsIssue[] {
    const { naturezaOperacaoId, paymentMethodMap = {} } = settings as BlingSettings;
    const issues: FiscalSettingsIssue[] = [];
    if (!naturezaOperacaoId) {
      issues.push({ key: "OPERATION_NATURE", message: "Escolha a natureza de operacao do Bling usada nas NFC-e" });
    }
    const missing = REQUIRED_PAYMENT_METHODS.filter((method) => !paymentMethodMap[method]);
    if (missing.length) {
      issues.push({
        key: "PAYMENT_MAP",
        message: `Vincule as formas de pagamento do Bling: ${missing.map((method) => PAYMENT_METHOD_LABELS[method]).join(", ")}`,
      });
    }
    return issues;
  }

  private async detail(ctx: ProviderContext, externalId: string): Promise<BlingNfceDetail> {
    const response = await this.client.get<{ data?: BlingNfceDetail }>(ctx.tenantId, ctx.accessToken, `/nfce/${encodeURIComponent(externalId)}`);
    if (!response?.data || typeof response.data.situacao !== "number") {
      throw new FiscalProviderError("INCOMPATIBLE_RESPONSE", "Consulta de NFC-e do Bling inesperada", true);
    }
    return response.data;
  }
}
