import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Payable, PayableInput, PayableOptions, PayablesResponse } from "@burgoos/types";
import { createPayable, getPayables, requestExportJob, updatePayable } from "../../../../lib/api";
import { PayablesClient } from "./payables-client";

vi.mock("../../../../lib/api", () => ({
  addPayablePayment: vi.fn(),
  cancelPayable: vi.fn(),
  createPayable: vi.fn(),
  getPayableAuditHistory: vi.fn(),
  getPayables: vi.fn(),
  requestExportJob: vi.fn(),
  reversePayablePayment: vi.fn(),
  updatePayable: vi.fn(),
}));

const expectedFormPayload: PayableInput = {
  categoryId: "category-food",
  supplierId: "supplier-market",
  description: "Conta mock",
  competenceDate: "2026-06-01",
  dueDate: "2026-06-20",
  expectedAmount: 120,
  recurrence: null,
};

vi.mock("./payable-form", () => ({
  PayableForm: ({
    onSubmit,
    payable,
  }: {
    onSubmit: (payload: PayableInput) => Promise<void>;
    payable?: Payable | null;
  }) => (
    <button
      data-testid="payable-form-submit"
      onClick={() => {
        void onSubmit({
          categoryId: "category-food",
          supplierId: "supplier-market",
          description: "Conta mock",
          competenceDate: "2026-06-01",
          dueDate: "2026-06-20",
          expectedAmount: 120,
          recurrence: null,
        });
      }}
      type="button"
    >
      {payable ? "Salvar mock" : "Criar mock"}
    </button>
  ),
}));

vi.mock("./payable-detail-dialog", () => ({
  PayableDetailDialog: ({
    payable,
    onEdit,
  }: {
    payable: Payable | null;
    onEdit?: (payable: Payable) => void;
  }) =>
    payable ? (
      <button
        onClick={() => {
          onEdit?.(payable);
        }}
        type="button"
      >
        Editar conta
      </button>
    ) : null,
}));

const getPayablesMock = vi.mocked(getPayables);
const createPayableMock = vi.mocked(createPayable);
const requestExportJobMock = vi.mocked(requestExportJob);
const updatePayableMock = vi.mocked(updatePayable);

describe("PayablesClient filters", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getPayablesMock.mockReset();
    createPayableMock.mockReset();
    requestExportJobMock.mockReset();
    updatePayableMock.mockReset();
    createPayableMock.mockResolvedValue(response([payable()]));
    requestExportJobMock.mockResolvedValue({
      id: "export-1",
      context: "PAYABLES",
      format: "CSV",
      status: "PENDING",
      filtersSnapshot: {},
      columnsSnapshot: null,
      requestedAt: "2026-06-29T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
      failedAt: null,
      errorMessage: null,
      fileName: null,
      fileMimeType: null,
      fileSizeBytes: null,
      progress: { processedRows: 0, totalRows: null, message: "Aguardando processamento" },
      expiresAt: null,
      downloadUrl: null,
    });
    updatePayableMock.mockResolvedValue(payable({ description: "Conta editada" }));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("submits category filter and preserves the selected value on empty results", async () => {
    getPayablesMock.mockResolvedValue({
      token: "token",
      payables: response([], {
        totalExpected: "0.00",
        totalPaid: "0.00",
        totalRemaining: "0.00",
        overdueAmount: "0.00",
        openCount: 0,
        overdueCount: 0,
      }),
      options,
    });

    await renderClient();
    changeMultiSelect("Categorias", "Insumos");
    await clickButton("Filtrar");

    expect(getPayablesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryIds: ["category-food"],
      })
    );
    expect(container.textContent).toContain("Nenhuma conta a pagar encontrada.");
    expect(container.textContent).toContain("R$ 0.00");
    expect(buttonByAriaLabel("Categorias").getAttribute("aria-label")).toContain("Insumos");
  });

  it("keeps metric cards and consultation area visible", async () => {
    await renderClient();

    expect(container.textContent).toContain("Previsto");
    expect(container.textContent).toContain("Pago");
    expect(container.textContent).toContain("Em aberto");
    expect(container.textContent).toContain("Vencido");
    expect(container.textContent).toContain("1 conta(s)");
    expect(container.textContent).toContain("0 vencida(s)");
    expect(container.textContent).toContain("Consulta");
  });

  it("shows zero metric cards when the current query has no values", async () => {
    await act(async () => {
      root.render(
        <PayablesClient
          initialPayables={response([], {
            totalExpected: "0.00",
            totalPaid: "0.00",
            totalRemaining: "0.00",
            overdueAmount: "0.00",
            openCount: 0,
            overdueCount: 0,
          })}
          options={options}
          token="token"
        />
      );
    });

    expect(container.textContent).toContain("Previsto");
    expect(container.textContent).toContain("Pago");
    expect(container.textContent).toContain("Em aberto");
    expect(container.textContent).toContain("Vencido");
    expect(container.textContent).toContain("R$ 0.00");
  });

  it("opens new payable in a modal and submits without leaving the page", async () => {
    getPayablesMock.mockResolvedValue({
      token: "token",
      payables: response([payable({ description: "Conta mock" })]),
      options,
    });

    await renderClient();
    await clickButton("Nova conta");

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Nova conta a pagar");

    await clickButton("Criar mock");

    expect(createPayableMock).toHaveBeenCalledWith("token", expectedFormPayload);
    expect(getPayablesMock).toHaveBeenCalledWith({
      start: "",
      end: "",
      statuses: [],
      categoryIds: [],
      supplierIds: [],
      competenceMonth: "",
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens edit in a modal from the list and submits the update", async () => {
    getPayablesMock.mockResolvedValue({
      token: "token",
      payables: response([payable({ description: "Conta editada" })]),
      options,
    });

    await renderClient();
    await clickButton("Editar");

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Editar conta a pagar"
    );

    await clickButton("Salvar mock");

    expect(updatePayableMock).toHaveBeenCalledWith("token", "payable-1", expectedFormPayload);
    expect(getPayablesMock).toHaveBeenCalledWith({
      start: "",
      end: "",
      statuses: [],
      categoryIds: [],
      supplierIds: [],
      competenceMonth: "",
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens edit in a modal from the detail dialog", async () => {
    await renderClient();
    await clickButton("Detalhes");
    await clickButton("Editar conta");

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Editar conta a pagar"
    );
  });

  it("requests reusable async export with current filters", async () => {
    await renderClient();
    changeMultiSelect("Categorias", "Insumos");
    await clickButton("CSV");

    expect(requestExportJobMock).toHaveBeenCalledWith("token", {
      context: "PAYABLES",
      format: "CSV",
      filters: expect.objectContaining({ categoryIds: ["category-food"] }),
    });
    expect(container.textContent).toContain(
      "Arquivo CSV solicitado. Ele sera criado em paralelo e voce sera notificado quando estiver concluido."
    );
    expect(button("Filtrar").disabled).toBe(false);
  });

  it("submits and clears supplier filter", async () => {
    getPayablesMock
      .mockResolvedValueOnce({
        token: "token",
        payables: response([
          payable({ supplierId: "supplier-market", supplierName: "Mercado Central" }),
        ]),
        options,
      })
      .mockResolvedValueOnce({
        token: "token",
        payables: response([payable()]),
        options,
      });

    await renderClient();
    changeMultiSelect("Fornecedores", "Mercado Central");
    await clickButton("Filtrar");
    await clickLastButton("Limpar");

    expect(getPayablesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        supplierIds: ["supplier-market"],
      })
    );
    expect(getPayablesMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        supplierIds: [],
      })
    );
    expect(buttonByAriaLabel("Fornecedores").getAttribute("aria-label")).toContain(
      "Todos os fornecedores"
    );
  });

  it("submits reference month and combined filters, then clears all controls", async () => {
    getPayablesMock
      .mockResolvedValueOnce({
        token: "token",
        payables: response([payable()]),
        options,
      })
      .mockResolvedValueOnce({
        token: "token",
        payables: response([payable()]),
        options,
      });

    await renderClient();
    changeInput("month", "2026-06");
    changeInput("date", "2026-06-01", 0);
    changeInput("date", "2026-06-30", 1);
    changeMultiSelect("Status", "Aberta");
    changeMultiSelect("Categorias", "Insumos");
    changeMultiSelect("Fornecedores", "Mercado Central");

    await clickButton("Filtrar");

    expect(getPayablesMock).toHaveBeenNthCalledWith(1, {
      start: "2026-06-01",
      end: "2026-06-30",
      statuses: ["OPEN"],
      categoryIds: ["category-food"],
      supplierIds: ["supplier-market"],
      competenceMonth: "2026-06",
    });

    await clickLastButton("Limpar");

    expect(getPayablesMock).toHaveBeenNthCalledWith(2, {
      start: "",
      end: "",
      statuses: [],
      categoryIds: [],
      supplierIds: [],
      competenceMonth: "",
    });
    expect(inputByType("month").value).toBe("");
  });

  async function renderClient() {
    await act(async () => {
      root.render(
        <PayablesClient initialPayables={response([payable()])} options={options} token="token" />
      );
    });
  }

  function changeMultiSelect(label: string, optionText: string) {
    const trigger = buttonByAriaLabel(label);
    act(() => {
      trigger.click();
    });
    const option = [...container.querySelectorAll("label")].find((item) =>
      item.textContent?.includes(optionText)
    );
    if (!option) throw new Error(`Multi-select option "${optionText}" not found`);
    act(() => {
      option.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    });
  }

  function changeInput(type: string, value: string, index = 0) {
    const input = inputByType(type, index);
    act(() => {
      setNativeInputValue(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function clickButton(label: string) {
    await act(async () => {
      button(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function clickLastButton(label: string) {
    const matches = [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (item) => item.textContent?.trim() === label
    );
    await act(async () => {
      matches.at(-1)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
  }

  function buttonByAriaLabel(label: string): HTMLButtonElement {
    const result = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.getAttribute("aria-label")?.startsWith(`${label}:`)
    );
    if (!result) throw new Error(`Multi-select "${label}" not found`);
    return result;
  }

  function inputByType(type: string, index = 0): HTMLInputElement {
    const input = container.querySelectorAll<HTMLInputElement>(`input[type="${type}"]`).item(index);

    if (!input) {
      throw new Error(`Input ${type} at index ${index} not found`);
    }

    return input;
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === label
    );

    if (!found) {
      throw new Error(`Button "${label}" not found`);
    }

    return found;
  }

  function setNativeInputValue(input: HTMLInputElement, value: string) {
    const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input) as HTMLInputElement,
      "value"
    )?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(input, value);
      return;
    }

    if (valueSetter) {
      valueSetter.call(input, value);
      return;
    }

    input.value = value;
  }
});

const options: PayableOptions = {
  categories: [
    { id: "category-food", name: "Insumos", active: true },
    { id: "category-rent", name: "Aluguel", active: true },
  ],
  accounts: [],
  suppliers: [
    { id: "supplier-market", name: "Mercado Central", active: true },
    { id: "supplier-owner", name: "Proprietario", active: true },
  ],
};

function response(
  items: Payable[],
  summary: PayablesResponse["summary"] = {
    totalExpected: "120.00",
    totalPaid: "0.00",
    totalRemaining: "120.00",
    overdueAmount: "0.00",
    openCount: items.length,
    overdueCount: 0,
  }
): PayablesResponse {
  return {
    items,
    summary,
  };
}

function payable(overrides: Partial<Payable> = {}): Payable {
  return {
    id: "payable-1",
    categoryId: "category-food",
    categoryName: "Insumos",
    supplierId: "supplier-market",
    supplierName: "Mercado Central",
    recurrenceGroupId: null,
    description: "Compra de insumos",
    documentReference: null,
    competenceDate: "2026-06-10",
    dueDate: "2026-06-20",
    expectedAmount: "120.00",
    paidAmount: "0.00",
    remainingAmount: "120.00",
    status: "OPEN",
    notes: null,
    cancelledAt: null,
    cancellationReason: null,
    payments: [],
    ...overrides,
  };
}
