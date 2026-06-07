"use client";

import type { FormEvent } from "react";
import type {
  FinancialCategory,
  FinancialRecurrenceFrequency,
  Payable,
  PayableInput,
  Supplier,
} from "@burgoos/types";

interface PayableFormProps {
  categories: FinancialCategory[];
  suppliers: Pick<Supplier, "id" | "name" | "active">[];
  payable?: Payable | null;
  busy?: boolean;
  onSubmit: (payload: PayableInput) => Promise<void>;
}

export function PayableForm({ categories, suppliers, payable, busy = false, onSubmit }: PayableFormProps) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const recurrenceEnabled = formData.get("recurrenceEnabled") === "on";

    await onSubmit({
      categoryId: String(formData.get("categoryId") ?? ""),
      supplierId: optionalText(formData, "supplierId") ?? null,
      description: String(formData.get("description") ?? ""),
      documentReference: optionalText(formData, "documentReference"),
      competenceDate: monthToDate(optionalText(formData, "competenceDate")),
      dueDate: String(formData.get("dueDate") ?? ""),
      expectedAmount: Number(formData.get("expectedAmount") ?? 0),
      notes: optionalText(formData, "notes"),
      recurrence: recurrenceEnabled
        ? {
            frequency: String(formData.get("frequency") ?? "MONTHLY") as FinancialRecurrenceFrequency,
            interval: Number(formData.get("interval") ?? 1),
            startsOn: String(formData.get("startsOn") ?? formData.get("dueDate") ?? ""),
            occurrenceCount: Number(formData.get("occurrenceCount") ?? 1),
          }
        : null,
    });
  }

  return (
    <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
      <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
        Descricao
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={payable?.description ?? ""}
          maxLength={160}
          name="description"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Categoria
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={payable?.categoryId ?? ""}
          disabled={categories.length === 0}
          name="categoryId"
          required
        >
          <option value="">Selecione</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Fornecedor
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={payable?.supplierId ?? ""}
          name="supplierId"
        >
          <option value="">Sem fornecedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Vencimento
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={payable?.dueDate ?? today()}
          name="dueDate"
          required
          type="date"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Competencia
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={dateToMonth(payable?.competenceDate)}
          name="competenceDate"
          type="month"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Valor previsto
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={payable?.expectedAmount ?? ""}
          min="0.01"
          name="expectedAmount"
          required
          step="0.01"
          type="number"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Documento
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={payable?.documentReference ?? ""}
          maxLength={120}
          name="documentReference"
        />
      </label>
      {!payable ? (
        <fieldset className="rounded-md border border-slate-200 p-3 md:col-span-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input name="recurrenceEnabled" type="checkbox" />
            Gerar recorrencia
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" name="frequency">
              <option value="MONTHLY">Mensal</option>
              <option value="WEEKLY">Semanal</option>
              <option value="YEARLY">Anual</option>
            </select>
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              defaultValue="1"
              min="1"
              name="interval"
              type="number"
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              defaultValue={today()}
              name="startsOn"
              type="date"
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              defaultValue="12"
              min="1"
              name="occurrenceCount"
              type="number"
            />
          </div>
        </fieldset>
      ) : null}
      <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-4">
        Observacoes
        <textarea
          className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={payable?.notes ?? ""}
          maxLength={500}
          name="notes"
        />
      </label>
      <button
        className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-4"
        disabled={busy || categories.length === 0}
        type="submit"
      >
        {busy ? "Processando..." : payable ? "Salvar conta" : "Criar conta a pagar"}
      </button>
    </form>
  );
}

function optionalText(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

function monthToDate(value?: string): string | undefined {
  return value ? `${value}-01` : undefined;
}

function dateToMonth(value?: string | null): string {
  return value ? value.slice(0, 7) : "";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
