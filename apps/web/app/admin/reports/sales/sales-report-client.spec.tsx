import type { SalesReportResponse } from "@burgoos/types";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SalesReportClient } from "./sales-report-client";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("start=2026-05-30&end=2026-06-01"),
}));

describe("sales report client", () => {
  it("renders the daily evolution chart with gross, net and zero-sale days", () => {
    const html = renderToStaticMarkup(
      <SalesReportClient
        orderPlatforms={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "FOOD_TRUCK",
            feeRate: 0,
            paymentFeeRate: 0,
            active: true,
          },
        ]}
        report={reportFixture}
      />
    );

    expect(html).toContain("Grafico de evolucao diaria");
    expect(html).toContain("Receita bruta e recebido liquido por dia.");
    expect(html).toContain("Bruto");
    expect(html).toContain("Recebido liquido");
    expect(html).toContain("2026-05-31 bruto R$ 0.00");
    expect(html).toContain("2026-06-01 liquido R$ 20.00");
  });
});

const reportFixture: SalesReportResponse = {
  filters: {
    start: "2026-05-30",
    end: "2026-06-01",
    page: 1,
    pageSize: 50,
  },
  summary: {
    orderCount: 2,
    grossRevenue: "50.00",
    acquiredNetRevenue: "48.50",
    paymentFeeAmount: "1.50",
    averageTicket: "25.00",
    periodStart: "2026-05-30",
    periodEnd: "2026-06-01",
  },
  daily: [
    {
      date: "2026-05-30",
      orderCount: 1,
      grossRevenue: "30.00",
      acquiredNetRevenue: "28.50",
      paymentFeeAmount: "1.50",
      averageTicket: "30.00",
      grossRevenueDeltaRate: null,
      orderCountDeltaRate: null,
    },
    {
      date: "2026-05-31",
      orderCount: 0,
      grossRevenue: "0.00",
      acquiredNetRevenue: "0.00",
      paymentFeeAmount: "0.00",
      averageTicket: "0.00",
      grossRevenueDeltaRate: null,
      orderCountDeltaRate: null,
    },
    {
      date: "2026-06-01",
      orderCount: 1,
      grossRevenue: "20.00",
      acquiredNetRevenue: "20.00",
      paymentFeeAmount: "0.00",
      averageTicket: "20.00",
      grossRevenueDeltaRate: null,
      orderCountDeltaRate: null,
    },
  ],
  byPaymentInstitution: [],
  byPaymentMethod: [],
  byChannel: [],
  analytical: {
    page: 1,
    pageSize: 50,
    total: 0,
    items: [],
  },
};
