import type {
  FiscalDocumentStatus,
  FiscalPendingReason,
  FiscalReadinessKey,
  OperationState,
  OrderFiscalStatus,
} from "@rrfive/types";

export type FiscalActionState<T> = OperationState & { data?: T };

export const FISCAL_STATUS: Record<OrderFiscalStatus, { label: string; classes: string }> = {
  NOT_ISSUED: { label: "Nao emitida", classes: "bg-slate-100 text-slate-700" },
  NOT_APPLICABLE: { label: "Nao aplicavel", classes: "bg-slate-100 text-slate-500" },
  PENDING: { label: "Na fila", classes: "bg-sky-100 text-sky-800" },
  PROCESSING: { label: "Processando", classes: "bg-sky-100 text-sky-800" },
  AUTHORIZED: { label: "Autorizada", classes: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejeitada", classes: "bg-red-100 text-red-800" },
  ERROR: { label: "Erro", classes: "bg-red-100 text-red-800" },
  CANCEL_PENDING: { label: "Cancelamento pendente", classes: "bg-amber-100 text-amber-900" },
  CANCELLED: { label: "Cancelada", classes: "bg-slate-200 text-slate-700" },
  CANCEL_FAILED: { label: "Cancelamento nao realizado", classes: "bg-red-100 text-red-800" },
};

export const PENDING_REASON: Record<FiscalPendingReason, string> = {
  REJECTED: "Rejeitada pela SEFAZ: corrija e reemita",
  ERROR: "Falha na emissao: reprocesse",
  CANCEL_MANUAL_REQUIRED: "Cancele no painel do provedor dentro do prazo",
  CANCEL_FAILED: "Cancelamento fora do prazo ou recusado: trate com o contador",
  MISSING_FISCAL_DATA: "Produto sem perfil fiscal",
  PROVIDER_DISCONNECTED: "Provedor desconectado: reconecte a conta",
  SAME_DAY_NOT_ISSUED: "Venda do dia sem NFC-e",
  TAX_DIVERGENCE: "Autorizada com CFOP/CSOSN diferente do perfil fiscal: revise a natureza no provedor",
};

export const READINESS_LABEL: Record<FiscalReadinessKey, string> = {
  ISSUER: "Emitente",
  ADDRESS: "Endereco",
  CONNECTION: "Provedor",
  CERTIFICATE: "Certificado A1",
  DEFAULT_PROFILE: "Perfil fiscal padrao",
  PRODUCTS_WITHOUT_PROFILE: "Produtos sem perfil",
  PAYMENT_MAP: "Formas de pagamento",
  OPERATION_NATURE: "Natureza de operacao",
};

export const PENDING_STATUSES: FiscalDocumentStatus[] = ["REJECTED", "ERROR", "CANCEL_PENDING", "CANCEL_FAILED"];

export function formatMoney(value: string | number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/** "faltam 12 min" / "prazo encerrado" for assisted cancellations. */
export function deadlineLabel(deadline: string | null, now = Date.now()): string | null {
  if (!deadline) return null;
  const minutes = Math.floor((new Date(deadline).getTime() - now) / 60_000);
  return minutes < 0 ? "prazo encerrado" : `faltam ${minutes} min`;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
