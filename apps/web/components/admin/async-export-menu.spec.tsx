import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsyncExportMenu } from "./async-export-menu";

describe("AsyncExportMenu", () => {
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

  it("calls export handler with selected format", async () => {
    const onExport = vi.fn();

    await act(async () => {
      root.render(<AsyncExportMenu onExport={onExport} />);
    });

    await click("CSV");
    await click("PDF");
    await click("XLSX");

    expect(onExport).toHaveBeenNthCalledWith(1, "CSV");
    expect(onExport).toHaveBeenNthCalledWith(2, "PDF");
    expect(onExport).toHaveBeenNthCalledWith(3, "XLSX");
  });

  it("disables format buttons while busy", async () => {
    await act(async () => {
      root.render(<AsyncExportMenu busy onExport={vi.fn()} />);
    });

    expect(button("CSV").disabled).toBe(true);
    expect(button("PDF").disabled).toBe(true);
    expect(button("XLSX").disabled).toBe(true);
  });

  async function click(label: string) {
    await act(async () => {
      button(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
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
});
