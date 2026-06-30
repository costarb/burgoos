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
    changeSelect("Todas as categorias", "category-food");
    await clickButton("Filtrar");

    expect(getPayablesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "category-food",
      })
    );
    expect(container.textContent).toContain("Nenhuma conta a pagar encontrada.");
    expect(container.textContent).toContain("R$ 0.00");
    expect(selectByOption("Todas as categorias").value).toBe("category-food");
  });

  it("keeps metric cards and consultation area visible", async () => {
    await renderClient();

    expect(container.textContent).toContain("Previsto");
    expect(container.textContent).toContain("Pago");
    expect(container.textContent).toContain("Em aberto");
    expect(container.textContent).toContain("Vencido");
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
      status: "",
      categoryId: "",
      supplierId: "",
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
      status: "",
      categoryId: "",
      supplierId: "",
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
    changeSelect("Todas as categorias", "category-food");
    await clickButton("CSV");

    expect(requestExportJobMock).toHaveBeenCalledWith("token", {
      context: "PAYABLES",
      format: "CSV",
      filters: expect.objectContaining({ categoryId: "category-food" }),
    });
    expect(container.textContent).toContain("Operacao concluida com sucesso.");
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
    changeSelect("Todos os fornecedores", "supplier-market");
    await clickButton("Filtrar");
    await clickButton("Limpar");

    expect(getPayablesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        supplierId: "supplier-market",
      })
    );
    expect(getPayablesMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        supplierId: "",
      })
    );
    expect(selectByOption("Todos os fornecedores").value).toBe("");
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
    changeSelect("Todos os status", "OPEN");
    changeSelect("Todas as categorias", "category-food");
    changeSelect("Todos os fornecedores", "supplier-market");

    await clickButton("Filtrar");

    expect(getPayablesMock).toHaveBeenNthCalledWith(1, {
      start: "2026-06-01",
      end: "2026-06-30",
      status: "OPEN",
      categoryId: "category-food",
      supplierId: "supplier-market",
      competenceMonth: "2026-06",
    });

    await clickButton("Limpar");

    expect(getPayablesMock).toHaveBeenNthCalledWith(2, {
      start: "",
      end: "",
      status: "",
      categoryId: "",
      supplierId: "",
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

  function changeSelect(optionText: string, value: string) {
    const select = selectByOption(optionText);
    act(() => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
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

  function selectByOption(optionText: string): HTMLSelectElement {
    const selects = [...container.querySelectorAll("select")];
    const select = selects.find((item) =>
      [...item.options].some((option) => option.textContent === optionText)
    );

    if (!select) {
      throw new Error(`Select with option "${optionText}" not found`);
    }

    return select;
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
