"use client";

import React, { FormEvent, useMemo, useState } from "react";
import type {
  OperationState,
  PaymentInstitution,
  PaymentInstitutionConfiguration,
  PaymentInstitutionConfigurationInput,
  PaymentInstitutionFilters,
} from "@burgoos/types";
import { Pencil, Plus, Power, Search, X } from "lucide-react";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import {
  createPaymentInstitution,
  listPaymentInstitutions,
  updatePaymentInstitution,
} from "../../../../lib/api";

interface PaymentInstitutionsClientProps {
  token: string;
  initialInstitutions: PaymentInstitutionConfiguration[];
  initialFilters: Required<PaymentInstitutionFilters>;
}

interface InstitutionFormState {
  name: string;
  code: string;
  paymentInstitution: PaymentInstitution | "";
  active: boolean;
}

type DialogState =
  | { mode: "create"; institution?: undefined }
  | { mode: "edit"; institution: PaymentInstitutionConfiguration };

const paymentInstitutionLabels: Record<PaymentInstitution, string> = {
  PAGBANK: "PagBank",
  MERCADO_PAGO: "Mercado Pago",
  DINHEIRO: "Dinheiro",
  CAIXA_LOCAL: "Caixa Local",
};

const paymentInstitutions = Object.keys(paymentInstitutionLabels) as PaymentInstitution[];

const emptyFilters: Required<PaymentInstitutionFilters> = {
  search: "",
  active: "",
};

const emptyForm: InstitutionFormState = {
  name: "",
  code: "",
  paymentInstitution: "",
  active: true,
};

export function PaymentInstitutionsClient({
  token,
  initialInstitutions,
  initialFilters,
}: PaymentInstitutionsClientProps) {
  const [institutions, setInstitutions] = useState(initialInstitutions);
  const [filters, setFilters] = useState<Required<PaymentInstitutionFilters>>(initialFilters);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const summary = useMemo(
    () => ({
      total: institutions.length,
      active: institutions.filter((institution) => institution.active).length,
      inactive: institutions.filter((institution) => !institution.active).length,
    }),
    [institutions]
  );

  async function run(message: string, action: () => Promise<void>, successMessage?: string) {
    if (busy) {
      return;
    }

    setBusy(true);
    setOperation({ status: "pending", message });

    try {
      await action();
      setOperation({
        status: "success",
        message: successMessage ?? "Operacao concluida com sucesso.",
      });
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
    setInstitutions(await listPaymentInstitutions(token, nextFilters));
  }

  async function applyFilters() {
    await run("Aplicando filtros de instituicoes.", async () => {
      await refresh(filters);
    });
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    await run("Limpando filtros de instituicoes.", async () => {
      await refresh(emptyFilters);
    });
  }

  async function create(payload: PaymentInstitutionConfigurationInput) {
    await run("Criando instituicao.", async () => {
      await createPaymentInstitution(token, payload);
      await refresh();
      setDialog(null);
    });
  }

  async function update(
    institution: PaymentInstitutionConfiguration,
    payload: PaymentInstitutionConfigurationInput
  ) {
    await run("Salvando instituicao.", async () => {
      await updatePaymentInstitution(token, institution.id, payload);
      await refresh();
      setDialog(null);
    });
  }

  async function toggleActive(institution: PaymentInstitutionConfiguration) {
    await run(
      institution.active ? "Inativando instituicao." : "Ativando instituicao.",
      async () => {
        await updatePaymentInstitution(token, institution.id, {
          name: institution.name,
          code: institution.code,
          paymentInstitution: institution.paymentInstitution,
          active: !institution.active,
        });
        await refresh();
      },
      institution.active ? "Instituicao inativada." : "Instituicao ativada."
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Financeiro</p>
          <h1 className="mt-1 text-3xl font-semibold">Instituicoes</h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulte e mantenha instituicoes usadas em contas financeiras e conciliacao.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy}
          onClick={() => setDialog({ mode: "create" })}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nova instituicao
        </button>
      </div>

      <OperationFeedback
        className="mt-4"
        onDismiss={() => setOperation({ status: "idle" })}
        state={operation}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Listadas" value={summary.total} />
        <MetricCard label="Ativas" value={summary.active} tone="success" />
        <MetricCard label="Inativas" value={summary.inactive} tone="muted" />
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Consulta</h2>
          <p className="text-sm text-slate-500">Filtre por nome, codigo ou status.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]">
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Nome ou codigo"
            value={filters.search}
          />
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) =>
              setFilters((current) => ({ ...current, active: event.target.value }))
            }
            value={filters.active}
          >
            <option value="">Todos os status</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={applyFilters}
            type="button"
          >
            <Search className="h-4 w-4" />
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
        <div className="hidden grid-cols-[1.3fr_1fr_1fr_0.7fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
          <span>Instituicao</span>
          <span>Codigo</span>
          <span>Integracao</span>
          <span>Status</span>
          <span>Acoes</span>
        </div>
        {institutions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nenhuma instituicao encontrada.</p>
        ) : (
          institutions.map((institution) => (
            <article
              className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 md:grid-cols-[1.3fr_1fr_1fr_0.7fr_auto] md:items-center"
              key={institution.id}
            >
              <p className="font-semibold">{institution.name}</p>
              <p className="text-sm text-slate-600">{institution.code}</p>
              <p className="text-sm text-slate-600">
                {institution.paymentInstitution
                  ? paymentInstitutionLabels[institution.paymentInstitution]
                  : "Personalizada"}
              </p>
              <InstitutionBadge tone={institution.active ? "success" : "muted"}>
                {institution.active ? "Ativa" : "Inativa"}
              </InstitutionBadge>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                  disabled={busy}
                  onClick={() => setDialog({ mode: "edit", institution })}
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
                <button
                  className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                    institution.active
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                  disabled={busy}
                  onClick={() => {
                    void toggleActive(institution);
                  }}
                  type="button"
                >
                  <Power className="h-4 w-4" />
                  {institution.active ? "Inativar" : "Ativar"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {dialog ? (
        <InstitutionDialog
          busy={busy}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onCreate={create}
          onUpdate={update}
        />
      ) : null}
    </main>
  );
}

function InstitutionDialog({
  busy,
  dialog,
  onClose,
  onCreate,
  onUpdate,
}: {
  busy: boolean;
  dialog: DialogState;
  onClose: () => void;
  onCreate: (payload: PaymentInstitutionConfigurationInput) => Promise<void>;
  onUpdate: (
    institution: PaymentInstitutionConfiguration,
    payload: PaymentInstitutionConfigurationInput
  ) => Promise<void>;
}) {
  const [form, setForm] = useState<InstitutionFormState>(() => toFormState(dialog));
  const isCreate = dialog.mode === "create";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: PaymentInstitutionConfigurationInput = {
      name: form.name,
      code: form.code,
      paymentInstitution: form.paymentInstitution || null,
      active: form.active,
    };

    if (isCreate) {
      await onCreate(payload);
      return;
    }

    await onUpdate(dialog.institution, payload);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <section className="w-full max-w-2xl rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isCreate ? "Nova instituicao" : "Editar instituicao"}
            </h2>
            <p className="text-sm text-slate-500">
              Atualize nome, codigo, status e vinculo com integracoes existentes.
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="grid gap-4 p-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Nome"
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              required
              value={form.name}
            />
            <TextField
              label="Codigo"
              onChange={(value) => setForm((current) => ({ ...current, code: value }))}
              placeholder="Ex: STONE"
              value={form.code}
            />
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Vinculo de conciliacao
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  paymentInstitution: event.target.value as PaymentInstitution | "",
                }))
              }
              value={form.paymentInstitution}
            >
              <option value="">Personalizada</option>
              {paymentInstitutions.map((institution) => (
                <option key={institution} value={institution}>
                  {paymentInstitutionLabels[institution]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({ ...current, active: event.target.checked }))
              }
              type="checkbox"
            />
            Instituicao ativa
          </label>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {isCreate ? "Criar instituicao" : "Salvar alteracoes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function toFormState(dialog: DialogState): InstitutionFormState {
  if (dialog.mode === "create") {
    return emptyForm;
  }

  return {
    name: dialog.institution.name,
    code: dialog.institution.code,
    paymentInstitution: dialog.institution.paymentInstitution ?? "",
    active: dialog.institution.active,
  };
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        className="rounded-md border border-slate-300 px-3 py-2"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
    </label>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "muted";
}) {
  const classes = {
    neutral: "border-slate-200 bg-white",
    success: "border-emerald-100 bg-emerald-50",
    muted: "border-slate-200 bg-slate-50",
  }[tone];

  return (
    <div className={`rounded-md border p-4 ${classes}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InstitutionBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "muted";
}) {
  const classes = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    muted: "border-slate-200 bg-slate-100 text-slate-600",
  }[tone];

  return (
    <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${classes}`}>
      {children}
    </span>
  );
}
