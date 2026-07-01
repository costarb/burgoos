import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagementReportResponse } from "@burgoos/types";
import { getManagementReport, requestExportJob } from "../../../../lib/api";
import { ManagementReportClient } from "./management-report-client";

vi.mock("../../../../lib/api", () => ({
  getManagementReport: vi.fn(),
  requestExportJob: vi.fn(),
}));

const getManagementReportMock = vi.mocked(getManagementReport);
const requestExportJobMock = vi.mocked(requestExportJob);

describe("ManagementReportClient", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getManagementReportMock.mockReset();
    getManagementReportMock.mockResolvedValue({ token: "token", report: reportFixture() });
    requestExportJobMock.mockReset();
    requestExportJobMock.mockResolvedValue({} as Awaited<ReturnType<typeof requestExportJob>>);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders default period and report sections", async () => {
    await renderClient();

    expect(container.textContent).toContain("Relatorio gerencial");
    expect(container.textContent).toContain("Resumo executivo");
    expect(container.textContent).toContain("Caixa");
    expect(container.textContent).toContain("Vendas");
    expect(container.textContent).toContain("Contas a pagar");
    expect(inputByType("date", 0).value).toBe("2026-06-01");
    expect(inputByType("date", 1).value).toBe("2026-06-30");
  });

  it("applies date filter and refreshes the report", async () => {
    getManagementReportMock.mockResolvedValue({
      token: "token",
      report: reportFixture({
        period: { start: "2026-07-01", end: "2026-07-31" },
        executiveSummary: {
          ...reportFixture().executiveSummary,
          grossRevenue: "2000.00",
          periodNarrative: "Novo periodo carregado.",
        },
        sales: {
          ...reportFixture().sales,
          netRevenue: "2000.00",
        },
      }),
    });

    await renderClient();
    changeInput(inputByType("date", 0), "2026-07-01");
    changeInput(inputByType("date", 1), "2026-07-31");
    await clickButton("Filtrar");

    expect(getManagementReportMock).toHaveBeenCalledWith({
      start: "2026-07-01",
      end: "2026-07-31",
    });
    expect(container.textContent).toContain("Receita liquidaR$ 2000.00");
    expect(container.textContent).toContain("Novo periodo carregado.");
  });

  it("renders sales dimensions, account balances and expense bars", async () => {
    await renderClient();

    expect(container.textContent).toContain("Mercado Pago");
    expect(container.textContent).toContain("Pix");
    expect(container.textContent).toContain("Balcao");
    expect(container.textContent).toContain("Conta Caixa");
    expect(container.textContent).toContain("Taxas");
    expect(container.textContent).toContain("Aluguel");
  });

  it("requests asynchronous PDF export with user feedback", async () => {
    await renderClient();
    await clickButton("PDF");

    expect(requestExportJobMock).toHaveBeenCalledWith("token", {
      context: "MANAGEMENT_REPORT",
      format: "PDF",
      filters: { start: "2026-06-01", end: "2026-06-30" },
    });
    expect(container.textContent).toContain("Relatorio PDF solicitado");
  });

  async function renderClient() {
    await act(async () => {
      root.render(<ManagementReportClient initialReport={reportFixture()} token="token" />);
    });
  }

  function inputByType(type: string, index = 0): HTMLInputElement {
    const input = container.querySelectorAll<HTMLInputElement>(`input[type="${type}"]`).item(index);

    if (!input) {
      throw new Error(`Input ${type} at index ${index} not found`);
    }

    return input;
  }

  function changeInput(input: HTMLInputElement, value: string) {
    act(() => {
      const prototypeValueSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input) as HTMLInputElement,
        "value"
      )?.set;
      if (prototypeValueSetter) {
        prototypeValueSetter.call(input, value);
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function clickButton(label: string) {
    await act(async () => {
      const found = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === label
      );

      if (!found) {
        throw new Error(`Button "${label}" not found`);
      }

      found.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
  }
});

function reportFixture(
  overrides: Partial<ManagementReportResponse> = {}
): ManagementReportResponse {
  return {
    period: { start: "2026-06-01", end: "2026-06-30" },
    executiveSummary: {
      grossRevenue: "1000.00",
      netRevenue: "920.00",
      cashNet: "600.00",
      finalBalance: "1600.00",
      payablesOpen: "300.00",
      payablesOverdue: "100.00",
      receivableAmount: "120.00",
      periodNarrative: "Resumo do periodo.",
    },
    cashFlow: {
      credits: "800.00",
      debits: "200.00",
      net: "600.00",
      finalBalance: "1600.00",
      balancesByAccount: [
        { accountId: "account-1", accountName: "Conta Caixa", balance: "1600.00" },
      ],
    },
    sales: {
      orders: 2,
      grossRevenue: "1000.00",
      netRevenue: "920.00",
      releasedAmount: "800.00",
      receivableAmount: "120.00",
      feeAmount: "80.00",
      averageTicket: "500.00",
      daily: [{ date: "2026-06-01", orders: 2, grossRevenue: "1000.00", netRevenue: "920.00" }],
      byInstitution: [
        {
          key: "MERCADO_PAGO",
          label: "Mercado Pago",
          orders: 2,
          grossRevenue: "1000.00",
          netRevenue: "920.00",
          shareOfGrossRevenue: 1,
        },
      ],
      byPaymentMethod: [
        {
          key: "PIX",
          label: "Pix",
          orders: 2,
          grossRevenue: "1000.00",
          netRevenue: "920.00",
          shareOfGrossRevenue: 1,
        },
      ],
      byChannel: [
        {
          key: "channel-1",
          label: "Balcao",
          orders: 2,
          grossRevenue: "1000.00",
          netRevenue: "920.00",
          shareOfGrossRevenue: 1,
        },
      ],
    },
    payables: {
      expected: "500.00",
      paid: "200.00",
      open: "300.00",
      overdue: "100.00",
      openCount: 2,
      overdueCount: 1,
      byCategory: [
        {
          categoryId: "category-tax",
          categoryName: "Taxas",
          expected: "300.00",
          paid: "200.00",
          open: "100.00",
          overdue: "100.00",
          shareOfExpected: 0.6,
        },
        {
          categoryId: "category-rent",
          categoryName: "Aluguel",
          expected: "200.00",
          paid: "0.00",
          open: "200.00",
          overdue: "0.00",
          shareOfExpected: 0.4,
        },
      ],
    },
    ...overrides,
  };
}
