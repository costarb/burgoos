"use client";

import type { FormEvent } from "react";
import type {
  CashMovement,
  CashMovementInput,
  CashMovementType,
  FinancialAccount,
  FinancialCategory,
} from "@burgoos/types";

interface CashMovementDialogProps {
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  movements: CashMovement[];
  busy?: boolean;
  onCreate: (payload: CashMovementInput) => Promise<void>;
  onReverse: (movementId: string, reason: string) => Promise<void>;
}

const movementLabels: Record<CashMovementType, string> = {
  MANUAL_INFLOW: "Entrada",
  MANUAL_OUTFLOW: "Saida",
  TRANSFER: "Transferencia",
  ADJUSTMENT: "Ajuste",
};

export function CashMovementDialog({
  accounts,
  categories,
  movements,
  busy = false,
  onCreate,
  onReverse,
}: CashMovementDialogProps) {
  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onCreate({
      type: String(formData.get("type") ?? "MANUAL_OUTFLOW") as CashMovementType,
      financialAccountId: String(formData.get("financialAccountId") ?? ""),
      destinationAccountId: optionalText(formData, "destinationAccountId") ?? null,
      categoryId: optionalText(formData, "categoryId") ?? null,
      amount: Number(formData.get("amount") ?? 0),
      occurredAt: String(formData.get("occurredAt") ?? today()),
      description: String(formData.get("description") ?? ""),
      justification: optionalText(formData, "justification"),
    });
    event.currentTarget.reset();
  }

  async function submitReverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onReverse(String(formData.get("movementId") ?? ""), String(formData.get("reason") ?? ""));
    event.currentTarget.reset();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submitMovement}>
        <h2 className="text-lg font-semibold">Movimento manual</h2>
        <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" name="type" required>
          {Object.entries(movementLabels).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          disabled={accounts.length === 0}
          name="financialAccountId"
          required
        >
          <option value="">Conta origem/afetada</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" name="destinationAccountId">
          <option value="">Conta destino apenas para transferencia</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" name="categoryId">
          <option value="">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            min="0.01"
            name="amount"
            placeholder="Valor"
            required
            step="0.01"
            type="number"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={today()}
            name="occurredAt"
            required
            type="date"
          />
        </div>
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          maxLength={160}
          name="description"
          placeholder="Descricao"
          required
        />
        <textarea
          className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm"
          maxLength={500}
          name="justification"
          placeholder="Justificativa para ajustes"
        />
        <button
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy || accounts.length === 0}
          type="submit"
        >
          {busy ? "Processando..." : "Registrar movimento"}
        </button>
      </form>

      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Movimentos recentes</h2>
        <div className="mt-3 space-y-3">
          {movements.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Nenhum movimento manual registrado.
            </p>
          ) : (
            movements.map((movement) => (
              <form className="rounded-md border border-slate-200 p-3" key={movement.id} onSubmit={submitReverse}>
                <input name="movementId" type="hidden" value={movement.id} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{movement.description}</p>
                    <p className="text-xs text-slate-500">
                      {movementLabels[movement.type]} - {formatDate(movement.occurredAt)} - {movement.financialAccountName}
                    </p>
                  </div>
                  <p className="font-semibold">R$ {movement.amount}</p>
                </div>
                {!movement.reversedAt ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                      maxLength={500}
                      name="reason"
                      placeholder="Motivo do estorno"
                      required
                    />
                    <button
                      className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                      disabled={busy}
                      type="submit"
                    >
                      Estornar
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-slate-500">Estornado</p>
                )}
              </form>
            ))
          )}
        </div>
      </div>
    </section>
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
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}
