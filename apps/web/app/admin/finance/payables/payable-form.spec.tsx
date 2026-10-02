import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PayableForm } from "./payable-form";

describe("PayableForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps required fields invalid before submitting from the modal form", async () => {
    const onSubmit = vi.fn();

    await act(async () => {
      root.render(
        <PayableForm
          categories={[{ id: "category-1", name: "Insumos", active: true, dreClass: "EXCLUDED" }]}
          onSubmit={onSubmit}
          suppliers={[]}
        />
      );
    });

    const form = container.querySelector("form");

    expect(form).not.toBeNull();
    expect(input("description").required).toBe(true);
    expect(input("expectedAmount").required).toBe(true);
    expect(select("categoryId").required).toBe(true);
    expect(form?.checkValidity()).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the category's DRE class and submits the payable adjustment", async () => {
    const onSubmit = vi.fn(async () => undefined);
    await act(async () => {
      root.render(
        <PayableForm
          categories={[
            { id: "category-1", name: "Insumos", active: true, dreClass: "EXCLUDED" },
            { id: "category-2", name: "Prestador", active: true, dreClass: "VARIABLE_EXPENSE" },
          ]}
          onSubmit={onSubmit}
          suppliers={[]}
        />
      );
    });

    await act(async () => {
      const category = select("categoryId");
      category.value = "category-2";
      category.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(select("dreClassOverride").options[0].textContent).toBe("Seguir a categoria (Despesa variavel)");

    await act(async () => {
      input("description").value = "Contador";
      input("expectedAmount").value = "800";
      input("dueDate").value = "2026-09-10";
      select("dreClassOverride").value = "FIXED_COST";
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "category-2", dreClassOverride: "FIXED_COST" })
    );
  });

  function input(name: string): HTMLInputElement {
    const found = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);

    if (!found) {
      throw new Error(`Input "${name}" not found`);
    }

    return found;
  }

  function select(name: string): HTMLSelectElement {
    const found = container.querySelector<HTMLSelectElement>(`select[name="${name}"]`);

    if (!found) {
      throw new Error(`Select "${name}" not found`);
    }

    return found;
  }
});
