import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Payable, PayableOptions, PayablesResponse } from "@burgoos/types";
import { getPayables } from "../../../../lib/api";
import { PayablesClient } from "./payables-client";

vi.mock("../../../../lib/api", () => ({
  addPayablePayment: vi.fn(),
  cancelPayable: vi.fn(),
  createPayable: vi.fn(),
  getPayableAuditHistory: vi.fn(),
  getPayables: vi.fn(),
  reversePayablePayment: vi.fn(),
  updatePayable: vi.fn(),
}));

vi.mock("./payable-form", () => ({
  PayableForm: () => <div data-testid="payable-form" />,
}));

vi.mock("./payable-detail-dialog", () => ({
  PayableDetailDialog: () => <div data-testid="payable-detail-dialog" />,
}));

const getPayablesMock = vi.mocked(getPayables);

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
      payables: response([]),
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
    expect(selectByOption("Todas as categorias").value).toBe("category-food");
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

function response(items: Payable[]): PayablesResponse {
  return {
    items,
    summary: {
      totalExpected: "120.00",
      totalPaid: "0.00",
      totalRemaining: "120.00",
      overdueAmount: "0.00",
      openCount: items.length,
      overdueCount: 0,
    },
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
