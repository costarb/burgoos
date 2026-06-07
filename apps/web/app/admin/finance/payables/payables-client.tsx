"use client";

import { useMemo, useState } from "react";
import type {
  FinancialAuditRecord,
  OperationState,
  Payable,
  PayableInput,
  PayableOptions,
  PayablePaymentInput,
  PayablesResponse,
  PayableStatus,
} from "@burgoos/types";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import {
  addPayablePayment,
  cancelPayable,
  createPayable,
  getPayableAuditHistory,
  getPayables,
  reversePayablePayment,
  updatePayable,
} from "../../../../lib/api";
import { PayableDetailDialog } from "./payable-detail-dialog";
import { PayableForm } from "./payable-form";

interface PayablesClientProps {
  token: string;
  initialPayables: PayablesResponse;
  options: PayableOptions;
}

const statusLabels: Record<PayableStatus, string> = {
  OPEN: "Aberta",
  OVERDUE: "Vencida",
  PARTIALLY_PAID: "Parcial",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

export function PayablesClient({ token, initialPayables, options }: PayablesClientProps) {
  const [payables, setPayables] = useState(initialPayables);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [auditRecords, setAuditRecords] = useState<FinancialAuditRecord[]>([]);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ start: "", end: "", status: "" });

  const selectedPayableSnapshot = useMemo(
    () => (selectedPayable ? payables.items.find((item) => item.id === selectedPayable.id) ?? selectedPayable : null),
    [payables.items, selectedPayable]
  );

  async function run(message: string, action: () => Promise<void>) {
    if (busy) {
      return;
    }

    setBusy(true);
    setOperation({ status: "pending", message });

    try {
      await action();
      setOperation({ status: "success", message: "Operacao concluida com sucesso." });
    } catch (error) {
      setOperation({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel concluir a operacao.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function refresh(nextFilters = filters) {
    const response = await getPayables(nextFilters);
    setPayables(response.payables);
  }

  async function openDetails(payable: Payable) {
    setSelectedPayable(payable);
    setAuditRecords([]);
    await run("Carregando historico da conta.", async () => {
      setAuditRecords(await getPayableAuditHistory(token, payable.id));
    });
  }

  async function applyFilters() {
    await run("Aplicando filtros de contas a pagar.", async () => {
      await refresh(filters);
    });
  }

  async function clearFilters() {
    const nextFilters = { start: "", end: "", status: "" };
    setFilters(nextFilters);
    await run("Limpando filtros de contas a pagar.", async () => {
      await refresh(nextFilters);
    });
  }

  async function create(payload: PayableInput) {
    await run("Criando conta a pagar.", async () => {
      await createPayable(token, payload);
      await refresh();
    });
  }

  async function update(payload: PayableInput) {
    if (!editingPayable) {
      return;
    }

    await run("Salvando conta a pagar.", async () => {
      await updatePayable(token, editingPayable.id, payload);
      await refresh();
      setEditingPayable(null);
    });
  }

  async function registerPayment(payable: Payable, payload: PayablePaymentInput) {
    await run("Registrando pagamento.", async () => {
      const updated = await addPayablePayment(token, payable.id, payload);
      setSelectedPayable(updated);
      await refresh();
      setAuditRecords(await getPayableAuditHistory(token, payable.id));
    });
  }

  async function cancel(payable: Payable, reason: string) {
    await run("Cancelando conta a pagar.", async () => {
      const updated = await cancelPayable(token, payable.id, { reason });
      setSelectedPayable(updated);
      await refresh();
      setAuditRecords(await getPayableAuditHistory(token, payable.id));
    });
  }

  async function reversePayment(paymentId: string, reason: string) {
    await run("Estornando pagamento.", async () => {
      const updated = await reversePayablePayment(token, paymentId, { reason });
      setSelectedPayable(updated);
      await refresh();
      setAuditRecords(await getPayableAuditHistory(token, updated.id));
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Financeiro</p>
          <h1 className="mt-1 text-3xl font-semibold">Contas a pagar</h1>
        </div>
        <a className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" href="/admin/reports/dre">
          Ver DRE
        </a>
      </div>

      <OperationFeedback className="mt-4" onDismiss={() => setOperation({ status: "idle" })} state={operation} />

      {options.categories.length === 0 ? (
        <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Cadastre ao menos uma categoria financeira para criar contas a pagar.
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Previsto" value={payables.summary.totalExpected} />
        <MetricCard label="Pago" value={payables.summary.totalPaid} />
        <MetricCard label="Em aberto" value={payables.summary.totalRemaining} />
        <MetricCard label="Vencido" tone="danger" value={payables.summary.overdueAmount} />
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Nova conta</h2>
        <div className="mt-4">
          <PayableForm
            busy={busy}
            categories={options.categories}
            onSubmit={create}
            suppliers={options.suppliers}
          />
        </div>
      </section>

      {editingPayable ? (
        <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Editar conta</h2>
            <button className="text-sm font-semibold text-slate-600" onClick={() => setEditingPayable(null)} type="button">
              Cancelar edicao
            </button>
          </div>
          <div className="mt-4">
            <PayableForm
              busy={busy}
              categories={options.categories}
              onSubmit={update}
              payable={editingPayable}
              suppliers={options.suppliers}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setFilters((current) => ({ ...current, start: event.target.value }))}
            type="date"
            value={filters.start}
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setFilters((current) => ({ ...current, end: event.target.value }))}
            type="date"
            value={filters.end}
          />
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            value={filters.status}
          >
            <option value="">Todos os status</option>
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={applyFilters}
            type="button"
          >
            Filtrar
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={busy}
            onClick={clearFilters}
            type="button"
          >
            Limpar
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
          <span>Conta</span>
          <span>Fornecedor</span>
          <span>Vencimento</span>
          <span>Previsto</span>
          <span>Status</span>
          <span>Acoes</span>
        </div>
        {payables.items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nenhuma conta a pagar encontrada.</p>
        ) : (
          payables.items.map((payable) => (
            <article
              className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto] md:items-center"
              key={payable.id}
            >
              <div>
                <p className="font-semibold">{payable.description}</p>
                <p className="text-xs text-slate-500">{payable.categoryName}</p>
              </div>
              <p className="text-sm">{payable.supplierName ?? "Sem fornecedor"}</p>
              <p className="text-sm">{formatDate(payable.dueDate)}</p>
              <p className="text-sm font-semibold">R$ {payable.expectedAmount}</p>
              <StatusBadge status={payable.status} />
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                  onClick={() => {
                    void openDetails(payable);
                  }}
                  type="button"
                >
                  Detalhes
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                  disabled={payable.status === "CANCELLED" || payable.status === "PAID"}
                  onClick={() => setEditingPayable(payable)}
                  type="button"
                >
                  Editar
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <PayableDetailDialog
        accounts={options.accounts}
        auditRecords={auditRecords}
        busy={busy}
        onCancel={cancel}
        onClose={() => {
          setSelectedPayable(null);
          setAuditRecords([]);
        }}
        onPayment={registerPayment}
        onReversePayment={reversePayment}
        payable={selectedPayableSnapshot}
      />
    </main>
  );
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <div className={`rounded-md border p-4 ${tone === "danger" ? "border-red-100 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">R$ {value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: PayableStatus }) {
  const classes = {
    OPEN: "border-slate-200 bg-slate-50 text-slate-700",
    OVERDUE: "border-red-200 bg-red-50 text-red-700",
    PARTIALLY_PAID: "border-amber-200 bg-amber-50 text-amber-800",
    PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
  }[status];

  return (
    <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${classes}`}>
      {statusLabels[status]}
    </span>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}
