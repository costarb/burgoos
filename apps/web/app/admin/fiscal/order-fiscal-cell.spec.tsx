import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderFiscalInfo } from "@rrfive/types";
import { OrderFiscalCell } from "./order-fiscal-cell";

describe("OrderFiscalCell", () => {
  let container: HTMLDivElement;
  let root: Root;
  const emitAction = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    emitAction.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const info = (overrides: Partial<OrderFiscalInfo> = {}): OrderFiscalInfo => ({
    status: "NOT_ISSUED",
    documentId: null,
    number: null,
    accessKey: null,
    consultationUrl: null,
    pendingReason: null,
    canEmit: true,
    blockedReason: null,
    target: { type: "ORDER", id: "order-1" },
    targetCode: null,
    ...overrides,
  });

  async function render(value: OrderFiscalInfo, saleDate = new Date().toISOString()) {
    await act(async () => root.render(<OrderFiscalCell emitAction={emitAction} info={value} saleDate={saleDate} />));
  }

  it("emits a same-day sale and shows the new status", async () => {
    emitAction.mockResolvedValue({
      status: "success",
      message: "Emissao da NFC-e solicitada.",
      data: { id: "doc-1", status: "PENDING", number: null, pendingReason: null },
    });
    await render(info());

    await act(async () => (container.querySelector("button") as HTMLButtonElement).click());

    expect(emitAction).toHaveBeenCalledWith({ type: "ORDER", id: "order-1" }, false);
    expect(container.textContent).toContain("NFC-e: Na fila");
    expect(container.textContent).toContain("Emissao da NFC-e solicitada.");
  });

  it("asks for confirmation before a retroactive emission", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await render(info(), new Date(Date.now() - 2 * 86_400_000).toISOString());

    await act(async () => (container.querySelector("button") as HTMLButtonElement).click());

    expect(confirm).toHaveBeenCalled();
    expect(emitAction).not.toHaveBeenCalled();
  });

  it("links DANFE and XML of an authorized note and hides the emit button", async () => {
    await render(info({ status: "AUTHORIZED", documentId: "doc-9", number: 12, canEmit: false }));

    expect(container.textContent).toContain("NFC-e: Autorizada nº 12");
    expect(container.querySelector("a[href='/api/admin/fiscal/documents/doc-9/danfe']")).not.toBeNull();
    expect(container.querySelector("a[href='/api/admin/fiscal/documents/doc-9/xml']")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("emits the whole tab when the order belongs to a paid tab", async () => {
    emitAction.mockResolvedValue({ status: "success", message: "ok", data: { id: "doc-2", status: "PENDING", number: null, pendingReason: null } });
    await render(info({ target: { type: "TAB", id: "tab-7" }, targetCode: "C07" }));

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.textContent).toBe("Emitir NFC-e da comanda C07");
    await act(async () => button.click());

    expect(emitAction).toHaveBeenCalledWith({ type: "TAB", id: "tab-7" }, false);
    expect(container.querySelector("button")).toBeNull();
  });

  it("hides the emit button and explains why while the sale is not paid", async () => {
    await render(info({ canEmit: false, blockedReason: "NOT_PAID" }));
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("[data-testid='order-fiscal-blocked']")?.textContent).toBe("Aguardando pagamento");

    await render(info({ canEmit: false, blockedReason: "TAB_NOT_PAID", target: { type: "TAB", id: "tab-7" } }));
    expect(container.textContent).toContain("Comanda ainda nao paga");
  });

  it("shares the public SEFAZ consultation on WhatsApp", async () => {
    await render(
      info({
        status: "AUTHORIZED",
        documentId: "doc-9",
        number: 12,
        accessKey: "35261011222333000181650010000000041689756832",
        consultationUrl: "https://www.nfce.fazenda.sp.gov.br/consulta",
        canEmit: false,
      })
    );
    const href = (container.querySelector("a[href^='https://wa.me/']") as HTMLAnchorElement).href;
    const text = decodeURIComponent(href.split("text=")[1]);
    expect(text).toBe(
      "Sua NFC-e nº 12 foi emitida.\nConsulte em https://www.nfce.fazenda.sp.gov.br/consulta\nChave de acesso: 3526 1011 2223 3300 0181 6500 1000 0000 0416 8975 6832"
    );
  });
});
