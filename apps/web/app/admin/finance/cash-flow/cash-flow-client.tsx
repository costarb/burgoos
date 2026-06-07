"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CashMovement,
  CashMovementInput,
  CashPosition,
  CashStatement,
  FinancialAccount,
  FinancialCategory,
  OperationState,
} from "@burgoos/types";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import {
  createCashMovement,
  getCashPosition,
  getCashStatement,
  listCashMovements,
  reverseCashMovement,
} from "../../../../lib/api";
import { CashMovementDialog } from "./cash-movement-dialog";
import { FinancialAccountDialog } from "./financial-account-dialog";

interface CashFlowClientProps {
  token: string;
  initialPosition: CashPosition;
  initialAccounts: FinancialAccount[];
  initialCategories: FinancialCategory[];
  initialMovements: CashMovement[];
  initialStatement: CashStatement;
}

export function CashFlowClient({
  token,
  initialPosition,
  initialAccounts,
  initialCategories,
  initialMovements,
  initialStatement,
}: CashFlowClientProps) {
  const [position, setPosition] = useState(initialPosition);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [categories, setCategories] = useState(initialCategories);
  const [movements, setMovements] = useState(initialMovements);
  const [statement, setStatement] = useState(initialStatement);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({
    asOf: initialPosition.asOf,
    projectionEnd: initialPosition.projectionEnd,
    financialAccountId: "",
  });
  const [statementFilters, setStatementFilters] = useState({
    start: initialStatement.start,
    end: initialStatement.end,
    financialAccountId: initialStatement.financialAccountId ?? "",
  });
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    let cancelled = false;

    async function refreshVisiblePosition() {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await getCashPosition(filtersRef.current);
        if (cancelled) {
          return;
        }

        setPosition(response.position);
        setAccounts(response.accounts);
        setCategories(response.categories);
      } catch {
        if (!cancelled) {
          setOperation({
            status: "error",
            message: "Nao foi possivel atualizar automaticamente a posicao de caixa.",
          });
        }
      }
    }

    window.addEventListener("focus", refreshVisiblePosition);
    document.addEventListener("visibilitychange", refreshVisiblePosition);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshVisiblePosition);
      document.removeEventListener("visibilitychange", refreshVisiblePosition);
    };
  }, []);

  async function run(message: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setOperation({ status: "pending", message });

    try {
      await action();
      setOperation({ status: "success", message: "Caixa atualizado com sucesso." });
    } catch (error) {
      setOperation({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar o caixa.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function refresh(nextFilters = filters) {
    const [response, nextMovements, nextStatement] = await Promise.all([
      getCashPosition(nextFilters),
      listCashMovements(token, {
        start: nextFilters.asOf,
        end: nextFilters.asOf,
      }),
      getCashStatement(token, statementFilters),
    ]);
    setPosition(response.position);
    setAccounts(response.accounts);
    setCategories(response.categories);
    setMovements(nextMovements);
    setStatement(nextStatement);
  }

  async function applyFilters() {
    await run("Atualizando posicao de caixa.", async () => {
      await refresh();
    });
  }

  async function applyStatementFilters() {
    await run("Atualizando extrato de caixa.", async () => {
      setStatement(await getCashStatement(token, statementFilters));
    });
  }

  async function createMovement(payload: CashMovementInput) {
    await run("Registrando movimento de caixa.", async () => {
      await createCashMovement(token, payload);
      await refresh();
    });
  }

  async function reverseMovement(movementId: string, reason: string) {
    await run("Estornando movimento de caixa.", async () => {
      await reverseCashMovement(token, movementId, { reason });
      await refresh();
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Financeiro</p>
          <h1 className="mt-1 text-3xl font-semibold">Controle de caixa</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Saldo realizado, recebiveis, contas a pagar e projecao consolidada.
          </p>
        </div>
      </div>

      <OperationFeedback className="mt-4" onDismiss={() => setOperation({ status: "idle" })} state={operation} />

      <section className="mt-6 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]">
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          onChange={(event) => setFilters((current) => ({ ...current, asOf: event.target.value }))}
          type="date"
          value={filters.asOf}
        />
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          onChange={(event) => setFilters((current) => ({ ...current, projectionEnd: event.target.value }))}
          type="date"
          value={filters.projectionEnd}
        />
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          onChange={(event) => setFilters((current) => ({ ...current, financialAccountId: event.target.value }))}
          value={filters.financialAccountId}
        >
          <option value="">Todas as contas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
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
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Saldo atual" value={position.currentBalance} />
        <MetricCard label="A receber" value={position.receivableAmount} />
        <MetricCard label="A pagar" tone="warning" value={position.payableAmount} />
        <MetricCard
          label="Saldo projetado"
          tone={position.negativeBalanceDetected ? "danger" : "neutral"}
          value={position.projectedBalance}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Saldos por conta</h2>
          <div className="mt-3 space-y-2">
            {position.accounts.map((account) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3" key={account.financialAccountId ?? "unallocated"}>
                <div>
                  <p className="font-semibold">{account.financialAccountName}</p>
                  <p className="text-xs text-slate-500">{account.unallocated ? "Sem mapeamento" : "Conta financeira"}</p>
                </div>
                <p className="font-semibold">R$ {account.balance}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Projecao</h2>
          <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
            {position.projection.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Nenhum evento projetado no periodo.</p>
            ) : (
              position.projection.slice(0, 8).map((entry) => (
                <div className="grid gap-2 border-b border-slate-100 p-3 last:border-b-0 md:grid-cols-[0.8fr_1.4fr_0.8fr_0.8fr]" key={`${entry.sourceType}-${entry.sourceId}`}>
                  <p className="text-sm">{formatDate(entry.occurredAt)}</p>
                  <p className="text-sm font-semibold">{entry.description}</p>
                  <p className="text-sm text-emerald-700">+ R$ {entry.inflowAmount}</p>
                  <p className="text-sm text-red-700">- R$ {entry.outflowAmount}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Extrato de caixa</h2>
            <p className="text-sm text-slate-600">Lancamentos realizados de credito e debito agrupados por data.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setStatementFilters((current) => ({ ...current, start: event.target.value }))}
            type="date"
            value={statementFilters.start}
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setStatementFilters((current) => ({ ...current, end: event.target.value }))}
            type="date"
            value={statementFilters.end}
          />
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setStatementFilters((current) => ({ ...current, financialAccountId: event.target.value }))}
            value={statementFilters.financialAccountId}
          >
            <option value="">Todas as contas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={applyStatementFilters}
            type="button"
          >
            Atualizar extrato
          </button>
        </div>

        <section className="mt-4 grid gap-3 md:grid-cols-4">
          <MetricCard label="Creditos" value={statement.totalCredit} />
          <MetricCard label="Debitos" tone="warning" value={statement.totalDebit} />
          <MetricCard label="Liquido" tone={statement.netAmount.startsWith("-") ? "danger" : "neutral"} value={statement.netAmount} />
          <MetricCard label="Saldo final" value={statement.closingBalance} />
        </section>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          {statement.days.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhum lancamento realizado no periodo.</p>
          ) : (
            statement.days.map((day) => (
              <details className="border-b border-slate-100 last:border-b-0" key={day.date}>
                <summary className="grid cursor-pointer gap-2 bg-slate-50 p-3 text-sm md:grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]">
                  <span className="font-semibold">{formatDate(day.date)}</span>
                  <span className="text-emerald-700">+ R$ {day.creditAmount}</span>
                  <span className="text-red-700">- R$ {day.debitAmount}</span>
                  <span>Liquido R$ {day.netAmount}</span>
                  <span className="font-semibold">Saldo R$ {day.runningBalance}</span>
                </summary>
                <div className="divide-y divide-slate-100">
                  {day.entries.map((entry) => (
                    <div
                      className="grid gap-2 p-3 text-sm md:grid-cols-[0.7fr_1.2fr_1fr_0.7fr]"
                      key={`${day.date}-${entry.sourceType}-${entry.sourceId}-${entry.entryType}`}
                    >
                      <span className={entry.entryType === "CREDIT" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                        {entry.entryType === "CREDIT" ? "Credito" : "Debito"} R$ {entry.amount}
                      </span>
                      <span>{entry.description}</span>
                      <span className="text-slate-500">{entry.financialAccountName}</span>
                      <span className="text-xs font-semibold uppercase text-slate-500">{sourceLabel(entry.sourceType)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      </section>

      <section className="mt-6">
        <CashMovementDialog
          accounts={accounts}
          busy={busy}
          categories={categories}
          movements={movements}
          onCreate={createMovement}
          onReverse={reverseMovement}
        />
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Ledger realizado</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
          {position.ledger.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhum evento realizado ate a data.</p>
          ) : (
            position.ledger.slice(-12).reverse().map((entry) => (
              <div className="grid gap-2 border-b border-slate-100 p-3 last:border-b-0 md:grid-cols-[0.7fr_1.4fr_0.8fr_0.8fr_0.8fr]" key={`${entry.sourceType}-${entry.sourceId}`}>
                <p className="text-sm">{formatDate(entry.occurredAt)}</p>
                <div>
                  <p className="text-sm font-semibold">{entry.description}</p>
                  <p className="text-xs text-slate-500">{entry.financialAccountName}</p>
                </div>
                <p className="text-sm text-emerald-700">+ R$ {entry.inflowAmount}</p>
                <p className="text-sm text-red-700">- R$ {entry.outflowAmount}</p>
                <p className="text-sm font-semibold">R$ {entry.runningBalance}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6">
        <FinancialAccountDialog
          initialAccounts={accounts}
          initialCategories={categories}
          token={token}
        />
      </section>
    </main>
  );
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warning" | "danger" }) {
  const classes = {
    neutral: "border-slate-200 bg-white",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-red-200 bg-red-50",
  }[tone];

  return (
    <div className={`rounded-md border p-4 ${classes}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">R$ {value}</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function sourceLabel(sourceType: string): string {
  return {
    OPENING_BALANCE: "Saldo inicial",
    ORDER_RECEIPT: "Pedido",
    PAYABLE_PAYMENT: "Conta paga",
    CASH_MOVEMENT: "Movimento",
  }[sourceType] ?? sourceType;
}
