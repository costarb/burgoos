"use client";

import type {
  AdminOrder,
  OrderPlatform,
  SalesAnalyticalOrder,
  SalesReportResponse,
} from "@burgoos/types";
import { useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { OrderMaintenanceDialog } from "../../orders/order-maintenance-dialog";

const paymentInstitutions = [
  ["", "Todas instituicoes"],
  ["PAGBANK", "PagBank"],
  ["MERCADO_PAGO", "Mercado Pago"],
  ["DINHEIRO", "Dinheiro"],
  ["CAIXA_LOCAL", "Caixa local"],
];

const paymentMethods = [
  ["", "Todos meios"],
  ["CASH", "Dinheiro"],
  ["PIX_MANUAL", "Pix manual"],
  ["CARD_ON_DELIVERY", "Cartao na entrega"],
  ["DEBIT_CARD", "Debito"],
  ["CREDIT_CARD", "Credito"],
  ["VOUCHER", "Voucher"],
  ["PIX", "Pix"],
];

const statuses = [
  ["", "Entregues"],
  ["PENDING", "Pendente"],
  ["PREPARING", "Preparando"],
  ["SHIPPED", "Enviado"],
  ["DELIVERED", "Entregue"],
  ["CANCELLED", "Cancelado"],
];

interface SalesReportClientProps {
  report: SalesReportResponse;
  orderPlatforms: OrderPlatform[];
  token: string;
}

export function SalesReportClient({ report, orderPlatforms, token }: SalesReportClientProps) {
  const searchParams = useSearchParams();
  const [maintenanceOrder, setMaintenanceOrder] = useState<AdminOrder | null>(null);
  const [analyticalItems, setAnalyticalItems] = useState(report.analytical.items);
  const previousPage = Math.max(1, report.analytical.page - 1);
  const nextPage = report.analytical.page + 1;
  const hasNextPage = report.analytical.page * report.analytical.pageSize < report.analytical.total;

  function replaceOrder(updatedOrder: AdminOrder): void {
    setAnalyticalItems((current) =>
      current.map((order) =>
        order.orderId === updatedOrder.id ? salesOrderFromAdminOrder(order, updatedOrder) : order
      )
    );
    setMaintenanceOrder(null);
  }

  function removeOrder(orderId: string): void {
    setAnalyticalItems((current) => current.filter((order) => order.orderId !== orderId));
    setMaintenanceOrder(null);
  }

  return (
    <div className="mt-8 space-y-6">
      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 lg:grid-cols-7">
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={report.filters.start}
          name="start"
          type="date"
        />
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={report.filters.end}
          name="end"
          type="date"
        />
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={report.filters.paymentInstitution ?? ""}
          name="paymentInstitution"
        >
          {paymentInstitutions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={report.filters.paymentMethod ?? ""}
          name="paymentMethod"
        >
          {paymentMethods.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={report.filters.orderPlatformId ?? ""}
          name="orderPlatformId"
        >
          <option value="">Todos canais</option>
          {orderPlatforms.map((platform) => (
            <option key={platform.id} value={platform.id}>
              {platform.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={report.filters.status ?? ""}
          name="status"
        >
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
          type="submit"
        >
          Filtrar
        </button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <SummaryCard label="Pedidos" value={String(report.summary.orderCount)} />
        <SummaryCard label="Receita bruta" value={`R$ ${report.summary.grossRevenue}`} />
        <SummaryCard label="Recebido liquido" value={`R$ ${report.summary.acquiredNetRevenue}`} />
        <SummaryCard
          label="Liberado/disponivel"
          value={`R$ ${report.summary.releasedNetRevenue}`}
        />
        {Number(report.receivables.receivableNetAmount) > 0 ? (
          <SummaryCard
            detail={
              report.receivables.nextExpectedReleaseDate
                ? `Prox. ${formatDate(report.receivables.nextExpectedReleaseDate)}`
                : undefined
            }
            label="Valores a receber"
            value={`R$ ${report.receivables.receivableNetAmount}`}
          />
        ) : null}
        <SummaryCard label="Taxas" value={`R$ ${report.summary.paymentFeeAmount}`} />
        <SummaryCard label="Ticket medio" value={`R$ ${report.summary.averageTicket}`} />
      </section>

      <DailyTrendChart daily={report.daily} />

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <SectionTitle title="Evolucao diaria" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Pedidos</th>
                <th className="px-4 py-3">Bruto</th>
                <th className="px-4 py-3">Liquido</th>
                <th className="px-4 py-3">Liberado</th>
                <th className="px-4 py-3">A receber</th>
                <th className="px-4 py-3">Taxas</th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Var. bruto</th>
              </tr>
            </thead>
            <tbody>
              {report.daily.map((day) => (
                <tr className="border-t border-slate-100" key={day.date}>
                  <td className="px-4 py-3 font-medium">
                    <DayLink date={day.date} searchParams={searchParams} />
                  </td>
                  <td className="px-4 py-3">{day.orderCount}</td>
                  <td className="px-4 py-3">R$ {day.grossRevenue}</td>
                  <td className="px-4 py-3">R$ {day.acquiredNetRevenue}</td>
                  <td className="px-4 py-3">R$ {day.releasedNetRevenue}</td>
                  <td className="px-4 py-3">R$ {day.receivableNetAmount}</td>
                  <td className="px-4 py-3">R$ {day.paymentFeeAmount}</td>
                  <td className="px-4 py-3">R$ {day.averageTicket}</td>
                  <td className="px-4 py-3">{formatRate(day.grossRevenueDeltaRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <DimensionTable title="Por instituicao" rows={report.byPaymentInstitution} />
        <DimensionTable title="Por meio" rows={report.byPaymentMethod} />
        <ChannelTable rows={report.byChannel} />
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <SectionTitle title="Analitico de pedidos" />
        {analyticalItems.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nenhum pedido encontrado no periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Data/hora</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Transacao</th>
                  <th className="px-4 py-3">Bruto</th>
                  <th className="px-4 py-3">Taxa</th>
                  <th className="px-4 py-3">Liquido</th>
                  <th className="px-4 py-3">Liberacao</th>
                  <th className="px-4 py-3">Produtos</th>
                  <th className="px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {analyticalItems.map((order) => (
                  <tr className="border-t border-slate-100" key={order.orderId}>
                    <td className="px-4 py-3">
                      {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">{order.status}</td>
                    <td className="px-4 py-3">{order.orderPlatformName ?? "Sem canal"}</td>
                    <td className="px-4 py-3">
                      {[order.paymentInstitution, order.paymentMethod, order.paymentBrand]
                        .filter(Boolean)
                        .join(" / ")}
                    </td>
                    <td className="px-4 py-3">{order.externalPaymentId ?? "-"}</td>
                    <td className="px-4 py-3">R$ {order.grossAmount}</td>
                    <td className="px-4 py-3">
                      {order.paymentFeeAmount ? `R$ ${order.paymentFeeAmount}` : "-"}
                    </td>
                    <td className="px-4 py-3">R$ {order.acquiredNetAmount}</td>
                    <td className="px-4 py-3">
                      <p>{releaseStatusLabel(order.paymentReleaseStatus)}</p>
                      <p className="text-xs text-slate-500">
                        {order.paymentReleaseExpectedAt
                          ? formatDate(order.paymentReleaseExpectedAt)
                          : "Sem data"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {order.assignedProducts
                        .map((product) => `${product.quantity}x ${product.productName}`)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold"
                        onClick={() => setMaintenanceOrder(toAdminOrder(order))}
                        type="button"
                      >
                        Alterar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
          <span>
            Pagina {report.analytical.page} de{" "}
            {Math.max(1, Math.ceil(report.analytical.total / report.analytical.pageSize))}
          </span>
          <div className="flex gap-2">
            <PageLink
              disabled={report.analytical.page <= 1}
              page={previousPage}
              searchParams={searchParams}
              text="Anterior"
            />
            <PageLink
              disabled={!hasNextPage}
              page={nextPage}
              searchParams={searchParams}
              text="Proxima"
            />
          </div>
        </div>
      </section>
      {maintenanceOrder ? (
        <OrderMaintenanceDialog
          onClose={() => setMaintenanceOrder(null)}
          onDeleted={removeOrder}
          onSaved={replaceOrder}
          order={maintenanceOrder}
          token={token}
        />
      ) : null}
    </div>
  );
}

function toAdminOrder(order: SalesAnalyticalOrder): AdminOrder {
  return {
    id: order.orderId,
    status: order.status,
    total: order.total,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentMethod: order.fulfillmentMethod,
    paymentMethod: order.paymentMethod,
    paymentInstitution: order.paymentInstitution,
    externalPaymentId: order.externalPaymentId,
    paymentGrossAmount: order.grossAmount,
    paymentFeeAmount: order.paymentFeeAmount,
    paymentNetAmount: order.acquiredNetAmount,
    paymentBrand: order.paymentBrand,
    paymentReleaseExpectedAt: order.paymentReleaseExpectedAt,
    paymentReleaseSource: order.paymentReleaseSource,
    orderPlatformId: order.orderPlatformId,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.assignedProducts.map((product) => ({
      id: product.id,
      productId: product.productId,
      productNameSnapshot: product.productName,
      quantity: product.quantity,
      unitPrice: product.unitPrice,
      total: product.total,
    })),
  };
}

function salesOrderFromAdminOrder(
  current: SalesAnalyticalOrder,
  updatedOrder: AdminOrder
): SalesAnalyticalOrder {
  return {
    ...current,
    createdAt: updatedOrder.createdAt ?? current.createdAt,
    updatedAt: updatedOrder.updatedAt ?? current.updatedAt,
    status: updatedOrder.status,
    total: updatedOrder.total,
    customerName: updatedOrder.customerName,
    customerPhone: updatedOrder.customerPhone,
    fulfillmentMethod: updatedOrder.fulfillmentMethod,
    notes: updatedOrder.notes,
    orderPlatformId: updatedOrder.orderPlatformId ?? null,
    paymentInstitution: updatedOrder.paymentInstitution ?? null,
    paymentMethod: updatedOrder.paymentMethod,
    externalPaymentId: updatedOrder.externalPaymentId ?? null,
    paymentBrand: updatedOrder.paymentBrand ?? null,
    grossAmount: updatedOrder.paymentGrossAmount ?? updatedOrder.total,
    paymentFeeAmount: updatedOrder.paymentFeeAmount ?? null,
    acquiredNetAmount:
      updatedOrder.paymentNetAmount ?? updatedOrder.paymentGrossAmount ?? updatedOrder.total,
    paymentReleaseExpectedAt: updatedOrder.paymentReleaseExpectedAt ?? null,
    paymentReleaseSource: updatedOrder.paymentReleaseSource ?? null,
    itemCount: updatedOrder.items.reduce((total, item) => total + item.quantity, 0),
    assignedProducts: updatedOrder.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      productName: item.productNameSnapshot,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
  };
}

function SummaryCard({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}

function DailyTrendChart({ daily }: { daily: SalesReportResponse["daily"] }) {
  const hasSales = daily.some(
    (day) => parseMoney(day.grossRevenue) > 0 || parseMoney(day.acquiredNetRevenue) > 0
  );
  const width = 760;
  const height = 260;
  const padding = { top: 24, right: 24, bottom: 44, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = daily.flatMap((day) => [
    parseMoney(day.grossRevenue),
    parseMoney(day.acquiredNetRevenue),
  ]);
  const maxValue = Math.max(...values, 0);
  const scaleMax = maxValue === 0 ? 1 : maxValue;
  const grossPoints = daily.map((day, index) =>
    toPoint(
      index,
      daily.length,
      parseMoney(day.grossRevenue),
      scaleMax,
      plotWidth,
      plotHeight,
      padding
    )
  );
  const netPoints = daily.map((day, index) =>
    toPoint(
      index,
      daily.length,
      parseMoney(day.acquiredNetRevenue),
      scaleMax,
      plotWidth,
      plotHeight,
      padding
    )
  );
  const labelStep = Math.max(1, Math.ceil(daily.length / 8));

  return (
    <section
      aria-label="Grafico de evolucao diaria"
      className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">Grafico de evolucao diaria</h2>
          <p className="text-sm text-slate-500">Receita bruta e recebido liquido por dia.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-ink" />
            Bruto
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-tomato" />
            Recebido liquido
          </span>
        </div>
      </div>

      {daily.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Sem dias no periodo selecionado.</p>
      ) : (
        <div className="overflow-x-auto px-3 py-4">
          {!hasSales ? (
            <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Nenhuma venda encontrada para desenhar a evolucao.
            </p>
          ) : null}
          {daily.length === 1 ? (
            <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Periodo com um unico dia; o grafico mostra os pontos do dia selecionado.
            </p>
          ) : null}
          <svg className="min-w-[720px] max-w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
            <title>Evolucao diaria de vendas</title>
            <desc>
              Grafico com receita bruta e recebido liquido para cada dia do periodo selecionado.
            </desc>
            <line
              stroke="#CBD5E1"
              strokeWidth="1"
              x1={padding.left}
              x2={width - padding.right}
              y1={height - padding.bottom}
              y2={height - padding.bottom}
            />
            <line
              stroke="#CBD5E1"
              strokeWidth="1"
              x1={padding.left}
              x2={padding.left}
              y1={padding.top}
              y2={height - padding.bottom}
            />
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + plotHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line
                    stroke="#E2E8F0"
                    strokeDasharray="4 4"
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                  />
                  <text
                    fill="#64748B"
                    fontSize="12"
                    textAnchor="end"
                    x={padding.left - 10}
                    y={y + 4}
                  >
                    {formatCompactMoney(scaleMax * ratio)}
                  </text>
                </g>
              );
            })}
            <polyline
              fill="none"
              points={grossPoints.map((point) => `${point.x},${point.y}`).join(" ")}
              stroke="#111827"
              strokeWidth="3"
            />
            <polyline
              fill="none"
              points={netPoints.map((point) => `${point.x},${point.y}`).join(" ")}
              stroke="#E54B36"
              strokeWidth="3"
            />
            {grossPoints.map((point, index) => (
              <g key={`gross-${daily[index].date}`}>
                <circle cx={point.x} cy={point.y} fill="#111827" r="4" />
                <title>{`${daily[index].date} bruto R$ ${daily[index].grossRevenue}`}</title>
              </g>
            ))}
            {netPoints.map((point, index) => (
              <g key={`net-${daily[index].date}`}>
                <circle cx={point.x} cy={point.y} fill="#E54B36" r="4" />
                <title>{`${daily[index].date} liquido R$ ${daily[index].acquiredNetRevenue}`}</title>
              </g>
            ))}
            {daily.map((day, index) => {
              if (index % labelStep !== 0 && index !== daily.length - 1) {
                return null;
              }
              const point = toPoint(
                index,
                daily.length,
                0,
                scaleMax,
                plotWidth,
                plotHeight,
                padding
              );
              return (
                <text
                  fill="#64748B"
                  fontSize="12"
                  key={day.date}
                  textAnchor="middle"
                  x={point.x}
                  y={height - 18}
                >
                  {formatDayLabel(day.date)}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="border-b border-slate-100 px-4 py-3 text-lg font-semibold">{title}</h2>;
}

function DimensionTable({
  title,
  rows,
}: {
  title: string;
  rows: SalesReportResponse["byPaymentInstitution"];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <SectionTitle title={title} />
      <table className="min-w-full text-left text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-4 text-slate-500">Sem dados</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="border-t border-slate-100" key={row.dimensionKey}>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.dimensionLabel}</p>
                  <p className="text-xs text-slate-500">
                    {(row.shareOfGrossRevenue * 100).toFixed(1)}%
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p>R$ {row.grossRevenue}</p>
                  <p className="text-xs text-slate-500">{row.orderCount} pedidos</p>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function ChannelTable({ rows }: { rows: SalesReportResponse["byChannel"] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <SectionTitle title="Por canal" />
      <table className="min-w-full text-left text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-4 text-slate-500">Sem dados</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                className="border-t border-slate-100"
                key={row.orderPlatformId ?? row.orderPlatformName}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{row.orderPlatformName}</p>
                  <p className="text-xs text-slate-500">{row.orderCount} pedidos</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p>R$ {row.grossRevenue}</p>
                  <p className="text-xs text-slate-500">Ticket R$ {row.averageTicket}</p>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function PageLink({
  disabled,
  page,
  searchParams,
  text,
}: {
  disabled: boolean;
  page: number;
  searchParams: ReturnType<typeof useSearchParams>;
  text: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-slate-200 px-3 py-2 text-slate-400">{text}</span>
    );
  }

  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));

  return (
    <a className="rounded-md border border-slate-300 px-3 py-2 font-semibold" href={`?${params}`}>
      {text}
    </a>
  );
}

function DayLink({
  date,
  searchParams,
}: {
  date: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("start", date);
  params.set("end", date);
  params.set("page", "1");

  return (
    <a className="font-semibold text-ink underline-offset-2 hover:underline" href={`?${params}`}>
      {date}
    </a>
  );
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function parseMoney(value: string): number {
  if (value.includes(",")) {
    return Number(value.replace(/\./g, "").replace(",", "."));
  }

  return Number(value);
}

function toPoint(
  index: number,
  total: number,
  value: number,
  maxValue: number,
  plotWidth: number,
  plotHeight: number,
  padding: { top: number; left: number; bottom: number; right: number }
) {
  const x = padding.left + (total <= 1 ? plotWidth / 2 : (plotWidth / (total - 1)) * index);
  const y = padding.top + plotHeight - (value / maxValue) * plotHeight;
  return { x, y };
}

function formatCompactMoney(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }

  return `R$ ${value.toFixed(0)}`;
}

function formatDayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function releaseStatusLabel(status: string): string {
  return status === "PENDING_RELEASE" ? "A receber" : "Liberado";
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
