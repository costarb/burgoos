"use client";

import type { FormEvent } from "react";
import type {
  FinancialAccount,
  FinancialAuditRecord,
  Payable,
  PayablePaymentInput,
} from "@burgoos/types";
import { ConfirmationDialog } from "../../../../components/admin/confirmation-dialog";

interface PayableDetailDialogProps {
  payable: Payable | null;
  accounts: FinancialAccount[];
  auditRecords: FinancialAuditRecord[];
  busy?: boolean;
  onClose: () => void;
  onEdit?: (payable: Payable) => void;
  onPayment: (payable: Payable, payload: PayablePaymentInput) => Promise<void>;
  onCancel: (payable: Payable, reason: string) => Promise<void>;
  onReversePayment: (paymentId: string, reason: string) => Promise<void>;
}

export function PayableDetailDialog({
  payable,
  accounts,
  auditRecords,
  busy = false,
  onClose,
  onEdit,
  onPayment,
  onCancel,
  onReversePayment,
}: PayableDetailDialogProps) {
  if (!payable) {
    return null;
  }

  const currentPayable = payable;

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await onPayment(currentPayable, {
      financialAccountId: String(formData.get("financialAccountId") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      paidAt: String(formData.get("paidAt") ?? today()),
      notes: optionalText(formData, "notes"),
    });
  }

  async function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onCancel(currentPayable, String(formData.get("reason") ?? ""));
  }

  async function submitReverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onReversePayment(
      String(formData.get("paymentId") ?? ""),
      String(formData.get("reason") ?? "")
    );
  }

  return (
    <ConfirmationDialog
      busy={busy}
      confirmLabel="Fechar"
      description={`${payable.description} - saldo em aberto R$ ${payable.remainingAmount}`}
      onCancel={onClose}
      onConfirm={onClose}
      open
      title="Detalhe da conta"
    >
      <div className="space-y-5 text-sm text-slate-700">
        <dl className="grid gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
          <Info label="Status" value={statusLabel(payable.status)} />
          <Info label="Vencimento" value={formatDate(payable.dueDate)} />
          <Info label="Previsto" value={`R$ ${payable.expectedAmount}`} />
          <Info label="Pago" value={`R$ ${payable.paidAmount}`} />
          <Info label="Fornecedor" value={payable.supplierName ?? "Sem fornecedor"} />
          <Info label="Categoria" value={payable.categoryName} />
        </dl>

        {onEdit && payable.status !== "CANCELLED" && payable.status !== "PAID" ? (
          <button
            className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:opacity-60"
            disabled={busy}
            onClick={() => onEdit(payable)}
            type="button"
          >
            Editar conta
          </button>
        ) : null}

        {payable.status !== "CANCELLED" && payable.status !== "PAID" ? (
          <form
            className="grid gap-3 rounded-md border border-slate-200 p-3"
            onSubmit={submitPayment}
          >
            <p className="font-semibold text-slate-950">Registrar pagamento</p>
            <select
              className="rounded-md border border-slate-200 px-3 py-2"
              disabled={accounts.length === 0}
              name="financialAccountId"
              required
            >
              <option value="">Conta financeira</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                max={payable.remainingAmount}
                min="0.01"
                name="amount"
                placeholder="Valor"
                required
                step="0.01"
                type="number"
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                defaultValue={today()}
                name="paidAt"
                required
                type="date"
              />
            </div>
            <textarea
              className="min-h-16 rounded-md border border-slate-200 px-3 py-2"
              maxLength={500}
              name="notes"
              placeholder="Observacoes"
            />
            <button
              className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
              disabled={busy || accounts.length === 0}
              type="submit"
            >
              {busy ? "Processando..." : "Registrar pagamento"}
            </button>
          </form>
        ) : null}

        <div>
          <p className="font-semibold text-slate-950">Pagamentos</p>
          <div className="mt-2 space-y-2">
            {payable.payments.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 p-3 text-slate-500">
                Nenhum pagamento registrado.
              </p>
            ) : (
              payable.payments.map((payment) => (
                <form
                  className="grid gap-2 rounded-md border border-slate-200 p-3"
                  key={payment.id}
                  onSubmit={submitReverse}
                >
                  <input name="paymentId" type="hidden" value={payment.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      R$ {payment.amount} em {formatDate(payment.paidAt)} -{" "}
                      {payment.financialAccountName}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {payment.reversedAt ? "Estornado" : "Ativo"}
                    </span>
                  </div>
                  {!payment.reversedAt ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2"
                        maxLength={500}
                        name="reason"
                        placeholder="Motivo do estorno"
                        required
                      />
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700 disabled:opacity-60"
                        disabled={busy}
                        type="submit"
                      >
                        Estornar
                      </button>
                    </div>
                  ) : null}
                </form>
              ))
            )}
          </div>
        </div>

        {!payable.cancelledAt && payable.paidAmount === "0.00" ? (
          <form
            className="grid gap-2 rounded-md border border-red-100 bg-red-50 p-3"
            onSubmit={submitCancel}
          >
            <p className="font-semibold text-red-900">Cancelar conta</p>
            <input
              className="rounded-md border border-red-200 px-3 py-2"
              maxLength={500}
              name="reason"
              placeholder="Motivo do cancelamento"
              required
            />
            <button
              className="rounded-md bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              Cancelar conta
            </button>
          </form>
        ) : null}

        <div>
          <p className="font-semibold text-slate-950">Historico</p>
          <div className="mt-2 space-y-2">
            {auditRecords.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 p-3 text-slate-500">
                Nenhum historico registrado.
              </p>
            ) : (
              auditRecords.map((record) => (
                <div className="rounded-md border border-slate-200 p-3" key={record.id}>
                  <p className="font-semibold text-slate-950">{auditLabel(record.action)}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(record.createdAt)} por {record.actorName} ({record.actorEmail})
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ConfirmationDialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function optionalText(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

function statusLabel(status: Payable["status"]): string {
  return {
    OPEN: "Aberta",
    OVERDUE: "Vencida",
    PARTIALLY_PAID: "Parcial",
    PAID: "Paga",
    CANCELLED: "Cancelada",
  }[status];
}

function auditLabel(action: FinancialAuditRecord["action"]): string {
  return {
    CREATE: "Criacao",
    UPDATE: "Alteracao",
    CANCEL: "Cancelamento",
    PAY: "Pagamento",
    REVERSE: "Estorno",
    ADJUST: "Ajuste",
  }[action];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
