import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  DollarSign,
  PackageSearch,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { FinancialDashboardIndicators } from "@burgoos/types";
import { getAdminDailySummary, getAdminTenantSummary, getFinancialDashboard } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const tenant = await getAdminTenantSummary();
  const [summaryResult, financialDashboardResult] = await Promise.allSettled([
    getAdminDailySummary(),
    getFinancialDashboard(),
  ]);
  const summary =
    summaryResult.status === "fulfilled"
      ? summaryResult.value
      : { date: new Date().toISOString().slice(0, 10), orderCount: 0, grossRevenue: "0.00" };
  const financialDashboard =
    financialDashboardResult.status === "fulfilled"
      ? financialDashboardResult.value
      : emptyFinancialDashboard();
  const alertCount = financialDashboard.priceReviewCount + financialDashboard.stockAlertCount;
  const hasDashboardWarning =
    summaryResult.status === "rejected" || financialDashboardResult.status === "rejected";

  return (
    <main className="px-4 py-6 text-slate-900 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-tomato">{tenant.name}</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Visao operacional</h1>
            <p className="mt-1 text-sm text-slate-600">
              Acompanhe o movimento e acesse as rotinas mais frequentes.
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            href="/admin/orders"
          >
            Abrir pedidos
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={ClipboardList}
            label="Pedidos entregues hoje"
            value={String(summary.orderCount)}
          />
          <Metric
            icon={DollarSign}
            label="Receita bruta hoje"
            value={`R$ ${summary.grossRevenue}`}
          />
          <Metric
            icon={TrendingUp}
            label="Margem liquida"
            value={`${(financialDashboard.netMarginRate * 100).toFixed(1)}%`}
          />
          <Metric
            icon={AlertTriangle}
            label="Alertas operacionais"
            value={String(alertCount)}
            warning={alertCount > 0}
          />
        </section>

        {hasDashboardWarning ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Alguns indicadores nao puderam ser carregados para este perfil ou ambiente.
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <h2 className="text-base font-semibold">Acesso rapido</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <QuickLink
                description="Acompanhar fila, finalizar e corrigir pedidos."
                href="/admin/orders"
                label="Pedidos"
              />
              <QuickLink
                description="Importar extratos e vendas realizadas."
                href="/admin/orders/import"
                label="Importar vendas"
              />
              <QuickLink
                description="Consultar necessidade de compra e saldo estimado."
                href="/admin/inventory"
                label="Estoque"
              />
              <QuickLink
                description="Analisar evolucao diaria e pagamentos a receber."
                href="/admin/reports/sales"
                label="Relatorio de vendas"
              />
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold">Resultado do periodo</h2>
            <dl className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white px-4">
              <SummaryRow label="CMV" value={`R$ ${financialDashboard.cmv}`} />
              <SummaryRow label="Lucro bruto" value={`R$ ${financialDashboard.grossProfit}`} />
              <SummaryRow
                label="Lucro liquido estimado"
                value={`R$ ${financialDashboard.estimatedNetProfit}`}
              />
              <SummaryRow
                label="Itens para revisar preco"
                value={String(financialDashboard.priceReviewCount)}
              />
              <SummaryRow
                label="Alertas de estoque"
                value={String(financialDashboard.stockAlertCount)}
              />
            </dl>
          </div>
        </section>
      </section>
    </main>
  );
}

function emptyFinancialDashboard(): FinancialDashboardIndicators {
  const today = new Date().toISOString().slice(0, 10);

  return {
    periodStart: today,
    periodEnd: today,
    grossRevenue: "0.00",
    cmv: "0.00",
    grossProfit: "0.00",
    estimatedNetProfit: "0.00",
    netMarginRate: 0,
    deliveredOrderCount: 0,
    priceReviewCount: 0,
    stockAlertCount: 0,
  };
}

function Metric({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof PackageSearch;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Icon aria-hidden className={`h-4 w-4 ${warning ? "text-amber-700" : "text-slate-500"}`} />
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function QuickLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      className="group rounded-md border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
      href={href}
    >
      <span className="flex items-center justify-between font-semibold">
        {label}
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
      <span className="mt-1 block text-sm text-slate-600">{description}</span>
    </Link>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
