import React, { act, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MultiSelectFilter } from "./multi-select-filter";

describe("MultiSelectFilter", () => {
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
    act(() => root.unmount());
    container.remove();
  });

  it("selects multiple options and clears them", () => {
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <MultiSelectFilter
          label="Contas"
          onChange={setValue}
          options={[
            { value: "a", label: "Caixa" },
            { value: "b", label: "Banco" },
          ]}
          placeholder="Todas as contas"
          value={value}
        />
      );
    }

    act(() => root.render(<Harness />));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
    expect(trigger.textContent).toContain("Todas as contas");
    act(() => trigger.click());
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    act(() => checkboxes[1].click());
    act(() => checkboxes[2].click());
    expect(trigger.textContent).toContain("Todos");
    const clear = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Limpar"
    )!;
    act(() => clear.click());
    expect(trigger.textContent).toContain("Todas as contas");
  });

  it("selects and clears every enabled option with one action", () => {
    const onChange = vi.fn();
    act(() =>
      root.render(
        <MultiSelectFilter
          label="Contas"
          onChange={onChange}
          options={[
            { value: "a", label: "Caixa" },
            { value: "b", label: "Banco" },
            { value: "c", label: "Inativa", disabled: true },
          ]}
          value={[]}
        />
      )
    );
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click()
    );
    act(() => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });

  it("closes with Escape and returns focus to the trigger", () => {
    act(() =>
      root.render(
        <MultiSelectFilter
          label="Contas"
          onChange={vi.fn()}
          options={[{ value: "a", label: "Caixa" }]}
          value={[]}
        />
      )
    );
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
    act(() => trigger.click());
    const list = container.querySelector<HTMLElement>('[role="listbox"]')!;
    act(() => list.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("disables itself when there are no options", () => {
    act(() =>
      root.render(
        <MultiSelectFilter
          emptyMessage="Nenhuma conta disponível"
          label="Contas"
          onChange={vi.fn()}
          options={[]}
          value={[]}
        />
      )
    );
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    expect(trigger.disabled).toBe(true);
    expect(trigger.textContent).toContain("Nenhuma conta disponível");
  });
});
