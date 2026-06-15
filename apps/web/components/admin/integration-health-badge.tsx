import type { DeliveryIntegrationStatus } from "@burgoos/types";

const statusLabel: Record<DeliveryIntegrationStatus, string> = {
  DRAFT: "Rascunho",
  VALIDATING: "Validando",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  REQUIRES_ATTENTION: "Atencao",
  DISABLED: "Desativada",
};

const statusClassName: Record<DeliveryIntegrationStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  VALIDATING: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700",
  REQUIRES_ATTENTION: "border-red-200 bg-red-50 text-red-700",
  DISABLED: "border-slate-200 bg-slate-50 text-slate-500",
};

export function IntegrationHealthBadge({ status }: { status: DeliveryIntegrationStatus }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold ${statusClassName[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}
