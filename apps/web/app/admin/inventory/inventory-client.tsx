"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import type { Ingredient, InventoryBalance, StockMovementType } from "@burgoos/types";
import { useRouter } from "next/navigation";
import { createStockMovement } from "../../../lib/api";

interface InventoryClientProps {
  token: string;
  balances: InventoryBalance[];
  ingredients: Ingredient[];
}

const statusLabels: Record<InventoryBalance["status"], string> = {
  OK: "OK",
  BUY: "Comprar",
  INSUFFICIENT: "Insuficiente",
};

const statusClasses: Record<InventoryBalance["status"], string> = {
  OK: "bg-green-50 text-green-800",
  BUY: "bg-amber-50 text-amber-800",
  INSUFFICIENT: "bg-red-50 text-red-800",
};

export function InventoryClient({ token, balances, ingredients }: InventoryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const ingredientId = String(formData.get("ingredientId") ?? "");
    const movementType = String(
      formData.get("movementType") ?? "MANUAL_ENTRY"
    ) as StockMovementType;
    const quantity = Number(formData.get("quantity") ?? 0);
    const reason = String(formData.get("reason") ?? "");

    startTransition(async () => {
      try {
        await createStockMovement(token, {
          ingredientId,
          movementType,
          quantity,
          reason: reason || undefined,
        });
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Falha ao movimentar estoque."
        );
      }
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Estoque</p>
            <h1 className="mt-1 text-3xl font-semibold">Saldos estimados</h1>
            <p className="mt-2 text-slate-600">
              Saldo estimado combina estoque informado, movimentacoes manuais e impacto de pedidos.
            </p>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/ingredients"
          >
            Editar insumos
          </a>
        </div>

        <form
          className="mt-8 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]"
          onSubmit={submit}
        >
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            name="ingredientId"
            required
          >
            <option value="">Insumo</option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue="MANUAL_ENTRY"
            name="movementType"
          >
            <option value="MANUAL_ENTRY">Entrada</option>
            <option value="MANUAL_ADJUSTMENT">Ajuste</option>
          </select>
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            min={0.001}
            name="quantity"
            placeholder="Quantidade"
            required
            step="0.001"
            type="number"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={180}
            name="reason"
            placeholder="Motivo"
          />
          <button
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending || ingredients.length === 0}
            type="submit"
          >
            Lançar
          </button>
        </form>
        {error ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Insumo</th>
                <th className="px-4 py-3 font-semibold">Estoque base</th>
                <th className="px-4 py-3 font-semibold">Mov. manuais</th>
                <th className="px-4 py-3 font-semibold">Reservado/baixado</th>
                <th className="px-4 py-3 font-semibold">Saldo estimado</th>
                <th className="px-4 py-3 font-semibold">Minimo</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {balances.map((balance) => (
                <tr key={balance.ingredientId}>
                  <td className="px-4 py-3 font-medium">{balance.ingredientName}</td>
                  <td className="px-4 py-3">{balance.currentStock.toFixed(3)}</td>
                  <td className="px-4 py-3">{balance.manualEntries.toFixed(3)}</td>
                  <td className="px-4 py-3">{balance.reservedOrConsumed.toFixed(3)}</td>
                  <td className="px-4 py-3 font-semibold">{balance.estimatedBalance.toFixed(3)}</td>
                  <td className="px-4 py-3">{balance.minimumStock.toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-3 py-1 text-xs font-semibold ${statusClasses[balance.status]}`}
                    >
                      {statusLabels[balance.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {balances.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>
                    Nenhum insumo cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
