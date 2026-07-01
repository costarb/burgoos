"use client";

import React, { useMemo, useState } from "react";
import type { ExportFormat, ManagementReportResponse, OperationState } from "@burgoos/types";
import { AsyncExportMenu } from "../../../../components/admin/async-export-menu";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import { getManagementReport, requestExportJob } from "../../../../lib/api";

interface ManagementReportClientProps {
  token: string;
  initialReport: ManagementReportResponse;
}

export function ManagementReportClient({ token, initialReport }: ManagementReportClientProps) {
  const [report, setReport] = useState(initialReport);
  const [start, setStart] = useState(initialReport.period.start);
  const [end, setEnd] = useState(initialReport.period.end);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const maxExpense = useMemo(
    () => Math.max(...report.payables.byCategory.map((category) => Number(category.expected)), 0),
    [report.payables.byCategory]
  );
  const maxSales = useMemo(
    () => Math.max(...report.sales.daily.map((day) => Number(day.grossRevenue)), 0),
    [report.sales.daily]
  );
  const topSummary = useMemo(() => buildTopSummary(report), [report]);

  async function applyFilters(nextStart = start, nextEnd = end) {
    if (busy) {
      return;
    }

    setBusy(true);
    setOperation({ status: "pending", message: "Carregando relatorio gerencial." });

    try {
      const response = await getManagementReport({ start: nextStart, end: nextEnd });
      setReport(response.report);
      setStart(response.report.period.start);
      setEnd(response.report.period.end);
      setOperation({ status: "success", message: "Relatorio atualizado." });
    } catch (error) {
      setOperation({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel carregar o relatorio.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function requestManagementExport(format: ExportFormat) {
    if (busy) {
      return;
    }

    setBusy(true);
    setOperation({ status: "pending", message: `Solicitando exportacao ${format}.` });

    try {
      await requestExportJob(token, {
        context: "MANAGEMENT_REPORT",
        format,
        filters: { start, end },
      });
      setOperation({
        status: "success",
        message:
          "Relatorio PDF solicitado. Ele sera criado em paralelo e voce sera notificado quando estiver concluido.",
      });
    } catch (error) {
      setOperation({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel solicitar a exportacao do relatorio.",
      });
    } finally {
      setBusy(false);
    }
  }

  function applyShortcut(shortcut: "current-month" | "previous-month" | "quarter" | "year") {
    const now = new Date();
    let range: { start: string; end: string };

    if (shortcut === "previous-month") {
      range = monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    } else if (shortcut === "quarter") {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      range = {
        start: toInputDate(new Date(now.getFullYear(), quarterStartMonth, 1)),
        end: toInputDate(new Date(now.getFullYear(), quarterStartMonth + 3, 0)),
      };
    } else if (shortcut === "year") {
      range = {
        start: toInputDate(new Date(now.getFullYear(), 0, 1)),
        end: toInputDate(new Date(now.getFullYear(), 11, 31)),
      };
    } else {
      range = monthRange(now);
    }

    setStart(range.start);
    setEnd(range.end);
    void applyFilters(range.start, range.end);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Relatorios</p>
            <h1 className="mt-1 text-3xl font-semibold">Relatorio gerencial</h1>
            <p className="mt-2 text-slate-600">
              Caixa, vendas e contas a pagar consolidados no periodo.
            </p>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin"
          >
            Painel
          </a>
          <AsyncExportMenu busy={busy} formats={["PDF"]} onExport={requestManagementExport} />
        </div>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Inicio
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setStart(event.target.value)}
                type="date"
                value={start}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Fim
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setEnd(event.target.value)}
                type="date"
                value={end}
              />
            </label>
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                void applyFilters();
              }}
              type="button"
            >
              Filtrar
            </button>
            <div className="flex flex-wrap gap-2">
              <ShortcutButton label="Mes atual" onClick={() => applyShortcut("current-month")} />
              <ShortcutButton
                label="Mes anterior"
                onClick={() => applyShortcut("previous-month")}
              />
              <ShortcutButton label="Trimestre" onClick={() => applyShortcut("quarter")} />
              <ShortcutButton label="Ano" onClick={() => applyShortcut("year")} />
            </div>
          </div>
        </section>

        <OperationFeedback
          className="mt-4"
          onDismiss={() => setOperation({ status: "idle" })}
          state={operation}
        />

        <section className="mt-6 grid gap-4 md:grid-cols-5">
          <MetricCard label="Receita liquida" value={topSummary.netRevenue} />
          <MetricCard label="Despesas pagas" value={topSummary.paidExpenses} />
          <MetricCard label="Saldo atual" value={topSummary.currentBalance} />
          <MetricCard label="Despesas a realizar" value={topSummary.pendingExpenses} />
          <MetricCard label="Saldo futuro" value={topSummary.futureBalance} />
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Resumo executivo</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {report.executiveSummary.periodNarrative}
          </p>
        </section>

        <section className="mt-6 grid gap-6">
          <Panel title="Vendas">
            <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.9fr)_minmax(420px,1.6fr)]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                <SmallMetric currency={false} label="Pedidos" value={String(report.sales.orders)} />
                <SmallMetric label="Receita bruta" value={report.sales.grossRevenue} />
                <SmallMetric label="Receita liquida" value={report.sales.netRevenue} />
                <SmallMetric label="Disponivel" value={report.sales.releasedAmount} />
                <SmallMetric label="A receber" value={report.sales.receivableAmount} />
                <SmallMetric label="Taxa" value={report.sales.feeAmount} />
                <SmallMetric label="Ticket medio" value={report.sales.averageTicket} />
              </div>
              <LineChart
                emptyText="Sem vendas no periodo."
                max={maxSales}
                rows={report.sales.daily.map((day) => ({
                  label: day.date.slice(5),
                  value: Number(day.grossRevenue),
                }))}
                title="Receita bruta por dia"
              />
            </div>
          </Panel>

          <section className="grid gap-6 lg:grid-cols-3">
            <DimensionPanel title="Por instituicao" rows={report.sales.byInstitution} />
            <DimensionPanel title="Por meio" rows={report.sales.byPaymentMethod} />
            <DimensionPanel title="Por canal" rows={report.sales.byChannel} />
          </section>

          <Panel title="Contas a pagar">
            <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.75fr)_minmax(420px,1.75fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <SmallMetric label="Previsto" value={report.payables.expected} />
                <SmallMetric label="Pago" value={report.payables.paid} />
                <SmallMetric label="Em aberto" value={report.payables.open} />
                <SmallMetric label="Vencido" value={report.payables.overdue} />
              </div>
              <MiniBars
                emptyText="Sem despesas no periodo."
                max={maxExpense}
                rows={report.payables.byCategory.map((category) => ({
                  label: category.categoryName,
                  value: Number(category.expected),
                }))}
                title="Despesas por categoria"
              />
            </div>
          </Panel>

          <Panel title="Caixa">
            <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.75fr)_minmax(420px,1.75fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <SmallMetric label="Creditos" value={report.cashFlow.credits} />
                <SmallMetric label="Debitos" value={report.cashFlow.debits} />
                <SmallMetric label="Liquido" value={report.cashFlow.net} />
                <SmallMetric label="Saldo final" value={report.cashFlow.finalBalance} />
              </div>
              <ListEmptyGuard empty={report.cashFlow.balancesByAccount.length === 0}>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {report.cashFlow.balancesByAccount.map((account) => (
                    <div
                      className="flex justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                      key={account.accountId ?? account.accountName}
                    >
                      <span className="truncate text-slate-600">{account.accountName}</span>
                      <span className="shrink-0 font-semibold">R$ {account.balance}</span>
                    </div>
                  ))}
                </div>
              </ListEmptyGuard>
            </div>
          </Panel>
        </section>
      </section>
    </main>
  );
}

function ShortcutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">R$ {value}</p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  currency = true,
}: {
  label: string;
  value: string;
  currency?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">
        {currency ? `R$ ${value}` : value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ListEmptyGuard({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  return empty ? <p className="mt-4 text-sm text-slate-500">Sem dados no periodo.</p> : children;
}

function MiniBars({
  rows,
  max,
  emptyText,
  title,
}: {
  rows: Array<{ label: string; value: number }>;
  max: number;
  emptyText: string;
  title?: string;
}) {
  if (rows.length === 0 || max === 0) {
    return <p className="mt-4 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {title ? <p className="text-sm font-semibold text-slate-700">{title}</p> : null}
      {rows.slice(0, 8).map((row) => (
        <div className="grid gap-1" key={row.label}>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{row.label}</span>
            <span>R$ {row.value.toFixed(2)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tomato"
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({
  rows,
  max,
  title,
  emptyText,
}: {
  rows: Array<{ label: string; value: number }>;
  max: number;
  title: string;
  emptyText: string;
}) {
  const visibleRows = sampleRows(rows, 10);
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 28, right: 18, bottom: 32, left: 18 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const points = visibleRows.map((row, index) => {
    const x =
      padding.left + (visibleRows.length > 1 ? (index / (visibleRows.length - 1)) * innerWidth : 0);
    const y = padding.top + innerHeight - (max > 0 ? (row.value / max) * innerHeight : 0);
    return { ...row, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");

  if (rows.length === 0 || max === 0) {
    return (
      <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-4 text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <svg
        aria-label={title}
        className="mt-3 h-64 w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <line
          stroke="#cbd5e1"
          strokeWidth="1"
          x1={padding.left}
          x2={chartWidth - padding.right}
          y1={padding.top + innerHeight}
          y2={padding.top + innerHeight}
        />
        <polyline fill="none" points={line} stroke="#e54835" strokeWidth="3" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} fill="#e54835" r="4" />
            <text
              fill="#334155"
              fontSize="11"
              textAnchor="middle"
              x={point.x}
              y={Math.max(12, point.y - 10)}
            >
              {formatCompactMoney(point.value)}
            </text>
            <text fill="#64748b" fontSize="10" textAnchor="middle" x={point.x} y={chartHeight - 8}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function sampleRows<T>(rows: T[], maxRows: number): T[] {
  if (rows.length <= maxRows) {
    return rows;
  }

  const step = (rows.length - 1) / (maxRows - 1);
  return Array.from({ length: maxRows }, (_, index) => rows[Math.round(index * step)]);
}

function formatCompactMoney(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }

  return `R$ ${value.toFixed(0)}`;
}

function DimensionPanel({
  title,
  rows,
}: {
  title: string;
  rows: ManagementReportResponse["sales"]["byInstitution"];
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Sem dados no periodo.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.slice(0, 6).map((row) => (
            <div className="flex justify-between gap-3 text-sm" key={row.key ?? row.label}>
              <div>
                <p className="font-semibold text-slate-800">{row.label}</p>
                <p className="text-xs text-slate-500">{row.orders} pedido(s)</p>
              </div>
              <p className="font-semibold">R$ {row.grossRevenue}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function monthRange(value: Date): { start: string; end: string } {
  return {
    start: toInputDate(new Date(value.getFullYear(), value.getMonth(), 1)),
    end: toInputDate(new Date(value.getFullYear(), value.getMonth() + 1, 0)),
  };
}

function toInputDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTopSummary(report: ManagementReportResponse) {
  const netRevenue = Number(report.sales.netRevenue);
  const paidExpenses = Number(report.payables.paid);
  const pendingExpenses = Number(report.payables.open);
  const currentBalance = netRevenue - paidExpenses;
  const futureBalance = currentBalance - pendingExpenses;

  return {
    netRevenue: moneyString(netRevenue),
    paidExpenses: moneyString(paidExpenses),
    currentBalance: moneyString(currentBalance),
    pendingExpenses: moneyString(pendingExpenses),
    futureBalance: moneyString(futureBalance),
  };
}

function moneyString(value: number): string {
  return value.toFixed(2);
}
