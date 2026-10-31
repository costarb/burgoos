import type { PaymentMethod } from "@prisma/client";
import { FiscalProviderError, NfceDraft, ProviderDocumentState } from "../fiscal-provider.adapter";

export interface BlingSettings {
  naturezaOperacaoId?: number | string;
  paymentMethodMap?: Partial<Record<PaymentMethod, number | string>>;
}

/** Payment methods the eligible sales of this phase can use; each needs a Bling payment form. */
export const REQUIRED_PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PIX", "PIX_MANUAL", "DEBIT_CARD", "CREDIT_CARD", "VOUCHER"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix (maquininha)",
  PIX_MANUAL: "Pix manual",
  DEBIT_CARD: "Cartao de debito",
  CREDIT_CARD: "Cartao de credito",
  VOUCHER: "Vale-refeicao",
  DIGITAL_WALLET: "Carteira digital",
  CARD_ON_DELIVERY: "Cartao na entrega",
};

const AUTHORIZED_SITUATIONS = new Set([5, 6, 7]);
const PROCESSING_SITUATIONS = new Set([1, 3, 8, 10]);
const REJECTED_SITUATIONS = new Set([4, 9, 11]);
const AUTHORIZED_CSTAT = new Set(["100", "150"]);

const round2 = (value: number) => Math.round(value * 100) / 100;

/** "2026-10-30 18:26:45" in São Paulo time, the format Bling expects. */
export function blingDateTime(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replace("T", " ");
}

const formatNcm = (ncm: string) => `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6, 8)}`;
const formatCest = (cest: string) => `${cest.slice(0, 2)}.${cest.slice(2, 5)}.${cest.slice(5, 7)}`;

/**
 * NFC-e create payload (validated against the Bling OpenAPI and homologation). Taxes (CSOSN, IBPT)
 * come from the operation nature configured in Bling; discounts/surcharges only exist at note level.
 */
export function toBlingNfce(draft: NfceDraft, settings: BlingSettings, now = new Date()) {
  if (!settings.naturezaOperacaoId) {
    throw new FiscalProviderError("VALIDATION", "Natureza de operacao do Bling nao configurada", false, "OPERATION_NATURE");
  }
  const today = blingDateTime(now).slice(0, 10);
  const change = Number(draft.change);
  let changeLeft = change;
  const parcelas = draft.payments.map((payment) => {
    const formaPagamento = settings.paymentMethodMap?.[payment.method];
    if (!formaPagamento) {
      throw new FiscalProviderError(
        "VALIDATION",
        `Forma de pagamento "${PAYMENT_METHOD_LABELS[payment.method]}" nao vinculada a uma forma do Bling`,
        false,
        "PAYMENT_MAP"
      );
    }
    let valor = Number(payment.amount);
    // Cash change: the note carries the amount actually kept, not the cash handed over.
    if (payment.method === "CASH" && changeLeft > 0) {
      const deducted = Math.min(valor, changeLeft);
      valor -= deducted;
      changeLeft -= deducted;
    }
    return { data: today, valor: round2(valor), formaPagamento: { id: Number(formaPagamento) } };
  });
  const consumer = draft.consumer?.document ?? null;
  return {
    tipo: 1,
    dataOperacao: blingDateTime(now),
    contato: consumer
      ? { nome: "Consumidor", tipoPessoa: consumer.length === 11 ? "F" : "J", numeroDocumento: consumer, contribuinte: 9 }
      : { nome: "Consumidor final", tipoPessoa: "F", numeroDocumento: "", contribuinte: 9 },
    naturezaOperacao: { id: Number(settings.naturezaOperacaoId) },
    desconto: round2(draft.items.reduce((sum, item) => sum + Number(item.discount), 0)),
    despesas: round2(draft.items.reduce((sum, item) => sum + Number(item.otherExpenses), 0)),
    observacoes: [draft.additionalInfo, `Ref. ${draft.reference}`].filter(Boolean).join(" | "),
    itens: draft.items.map((item) => ({
      codigo: item.code.slice(0, 60),
      descricao: item.description,
      unidade: item.unit,
      quantidade: Number(item.quantity),
      valor: Number(item.unitPrice),
      tipo: "P",
      classificacaoFiscal: formatNcm(item.ncm),
      ...(item.cest ? { cest: formatCest(item.cest) } : {}),
      origem: item.origin,
      cfop: item.cfop,
    })),
    parcelas: parcelas.filter((parcela) => parcela.valor > 0),
  };
}

/** Text of each `<name>` element; SEFAZ messages may carry brackets ("[nItem:4]") or CDATA. */
function tag(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${name}>`, "g"))].map(
    (match) => match[1] ?? match[2]
  );
}

/** Result of POST /nfce/{id}/enviar: SEFAZ SOAP envelope (`retEnviNFe` with `protNFe`). */
export function parseSendResult(externalId: string, body: unknown): ProviderDocumentState {
  const xml = (body as { data?: { xml?: unknown } })?.data?.xml;
  if (typeof xml !== "string" || !xml.includes("retEnviNFe")) {
    throw new FiscalProviderError("INCOMPATIBLE_RESPONSE", "Resposta de envio do Bling inesperada", true);
  }
  const hasProtocol = xml.includes("<protNFe");
  // The note result lives in protNFe; the outer cStat/xMotivo describe the batch ("104 Lote processado").
  const protocolXml = hasProtocol ? xml.slice(xml.indexOf("<protNFe")) : xml;
  const statuses = tag(protocolXml, "cStat");
  const reasons = tag(protocolXml, "xMotivo");
  if (!hasProtocol) {
    // Batch received but not processed yet (e.g. 103/105): follow up through the sync job.
    return { status: "PROCESSING", externalId };
  }
  const code = statuses[statuses.length - 1];
  const message = reasons[reasons.length - 1] ?? "Sem motivo";
  if (AUTHORIZED_CSTAT.has(code)) {
    return {
      status: "AUTHORIZED",
      externalId,
      number: null,
      series: null,
      accessKey: tag(xml, "chNFe")[0] ?? null,
      protocol: tag(xml, "nProt")[0] ?? null,
      authorizedAt: tag(xml, "dhRecbto").pop() ?? null,
      qrCodeUrl: null,
      consultationUrl: null,
      danfeUrl: null,
    };
  }
  return { status: "REJECTED", externalId, code, message };
}

export interface BlingNfceDetail {
  id: number;
  situacao: number;
  numero?: string;
  serie?: number | string;
  chaveAcesso?: string;
  dataEmissao?: string;
  valorNota?: number;
  xml?: string;
  linkDanfe?: string;
  linkPDF?: string;
  itens?: Array<{ codigo?: string }>;
}

/** Fields read from the authorized nfeProc XML (QR code and public consultation URL). */
export function parseAuthorizedXml(xml: string): { qrCodeUrl: string | null; consultationUrl: string | null; protocol: string | null } {
  return {
    qrCodeUrl: tag(xml, "qrCode")[0] ?? null,
    consultationUrl: tag(xml, "urlChave")[0] ?? null,
    protocol: tag(xml, "nProt")[0] ?? null,
  };
}

/** Bling date "2026-10-30 18:26:45" (São Paulo) → ISO. */
export function blingDateToIso(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value.replace(" ", "T")}-03:00`).toISOString();
}

export function stateFromDetail(detail: BlingNfceDetail, xmlFields?: ReturnType<typeof parseAuthorizedXml>): ProviderDocumentState {
  const externalId = String(detail.id);
  if (AUTHORIZED_SITUATIONS.has(detail.situacao)) {
    return {
      status: "AUTHORIZED",
      externalId,
      number: detail.numero ? Number(detail.numero) : null,
      series: detail.serie !== undefined ? Number(detail.serie) : null,
      accessKey: detail.chaveAcesso || null,
      protocol: xmlFields?.protocol ?? null,
      authorizedAt: blingDateToIso(detail.dataEmissao),
      qrCodeUrl: xmlFields?.qrCodeUrl ?? null,
      consultationUrl: xmlFields?.consultationUrl ?? null,
      danfeUrl: detail.linkDanfe || null,
    };
  }
  if (detail.situacao === 2) return { status: "CANCELLED", externalId, cancelledAt: null, protocol: null };
  if (REJECTED_SITUATIONS.has(detail.situacao)) {
    const labels: Record<number, string> = { 4: "Rejeitada pela SEFAZ", 9: "Uso denegado pela SEFAZ", 11: "Bloqueada no Bling" };
    return { status: "REJECTED", externalId, code: `BLING_SITUACAO_${detail.situacao}`, message: labels[detail.situacao] };
  }
  if (PROCESSING_SITUATIONS.has(detail.situacao)) return { status: "PROCESSING", externalId };
  throw new FiscalProviderError("INCOMPATIBLE_RESPONSE", `Situacao de NFC-e desconhecida no Bling: ${detail.situacao}`, true);
}
