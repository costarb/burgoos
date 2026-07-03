import React from "react";
import { getAdminToken, getOrderPlatforms, getSalesReport } from "../../../../lib/api";
import { SalesReportClient } from "./sales-report-client";

export const dynamic = "force-dynamic";

interface SalesReportPageProps {
  searchParams: {
    start?: string;
    end?: string;
    paymentInstitution?: string;
    paymentMethod?: string;
    orderPlatformId?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  };
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  const token = await getAdminToken();
  const [report, platformData] = await Promise.all([
    getSalesReport(
      {
        start: searchParams.start,
        end: searchParams.end,
        paymentInstitution: searchParams.paymentInstitution as never,
        paymentMethod: searchParams.paymentMethod as never,
        orderPlatformId: searchParams.orderPlatformId,
        status: searchParams.status as never,
        page: searchParams.page ? Number(searchParams.page) : undefined,
        pageSize: searchParams.pageSize ? Number(searchParams.pageSize) : undefined,
      },
      token
    ),
    getOrderPlatforms(),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Relatorios</p>
            <h1 className="mt-1 text-3xl font-semibold">Vendas e pedidos</h1>
            <p className="mt-2 text-slate-600">
              Evolucao diaria, filtros de conciliacao e analitico dos pedidos do periodo.
            </p>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin"
          >
            Painel
          </a>
        </div>

        <SalesReportClient
          orderPlatforms={platformData.orderPlatforms}
          report={report}
          token={token}
        />
      </section>
    </main>
  );
}
