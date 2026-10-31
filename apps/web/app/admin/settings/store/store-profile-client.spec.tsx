import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreDetail } from "@rrfive/types";
import { StoreProfileClient } from "./store-profile-client";

describe("StoreProfileClient", () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveAction = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveAction.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const store = (overrides: Partial<StoreDetail> = {}): StoreDetail =>
    ({
      id: "store-1",
      name: "Dogao",
      slug: "dogao",
      publicDomain: "dogao.com.br",
      phone: "11999999999",
      active: true,
      isOpen: true,
      openMode: "SCHEDULE",
      operatingHours: {},
      address: { street: "Rua Augusta", number: "100", neighborhood: "Consolacao", city: "Sao Paulo", state: "SP", postalCode: "01305000" },
      socialLinks: {},
      legal: {
        legalName: null,
        tradeName: null,
        cnpj: null,
        stateRegistration: null,
        taxRegime: null,
        municipalityIbgeCode: "3550308",
        municipalityIbgeSource: "IBGE_API",
      },
      ...overrides,
    }) as StoreDetail;

  async function change(label: string, value: string) {
    await act(async () => {
      const input = container.querySelector(`input[aria-label='${label}']`) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("shows platform-only fields read-only and saves contact, address and fiscal data", async () => {
    saveAction.mockResolvedValue({
      status: "success",
      message: "Dados da loja salvos.",
      data: store({ legal: { legalName: "Dogao LTDA", tradeName: null, cnpj: "11222333000181", stateRegistration: "110042490114", taxRegime: "SIMPLES_NACIONAL", municipalityIbgeCode: "3550308", municipalityIbgeSource: "IBGE_API" } }),
    });
    await act(async () => root.render(<StoreProfileClient saveAction={saveAction} store={store()} />));

    expect(container.querySelector("[data-testid='store-platform-fields']")?.textContent).toContain("/dogao");
    expect(container.querySelector("input[aria-label='Slug']")).toBeNull();
    expect((container.querySelector("input[aria-label='Codigo IBGE do municipio']") as HTMLInputElement).placeholder).toBe("3550308 (automatico pela cidade)");

    await change("Razao social", "Dogao LTDA");
    await change("CNPJ", "11.222.333/0001-81");
    await change("Inscricao estadual", "110.042.490.114");
    await change("UF", "sp");
    await act(async () => (container.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(saveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Dogao",
        address: expect.objectContaining({ street: "Rua Augusta", state: "SP" }),
        legalName: "Dogao LTDA",
        cnpj: "11.222.333/0001-81",
        stateRegistration: "110.042.490.114",
        taxRegime: "SIMPLES_NACIONAL",
        municipalityIbgeCode: null,
      })
    );
    expect(saveAction.mock.calls[0][0]).not.toHaveProperty("slug");
    expect(container.textContent).toContain("Dados da loja salvos.");
  });

  it("shows the validation message returned by the API", async () => {
    saveAction.mockResolvedValue({ status: "error", message: "Inscricao estadual invalida para SP" });
    await act(async () => root.render(<StoreProfileClient saveAction={saveAction} store={store()} />));

    await act(async () => (container.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(container.textContent).toContain("Inscricao estadual invalida para SP");
  });
});
