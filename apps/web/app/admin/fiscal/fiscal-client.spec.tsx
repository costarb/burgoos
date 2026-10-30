import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BlingConnectionOptions,
  FiscalConfigurationView,
  FiscalDocumentPage,
  FiscalDocumentSummary,
  FiscalProfileView,
} from "@rrfive/types";
import { FiscalClient, type FiscalTab } from "./fiscal-client";

describe("FiscalClient", () => {
  let container: HTMLDivElement;
  let root: Root;
  const configurationActions = {
    saveConfiguration: vi.fn(),
    saveIssuer: vi.fn(),
    startBlingAuthorization: vi.fn(),
    loadBlingOptions: vi.fn(),
    saveBlingSettings: vi.fn(),
    disconnectBling: vi.fn(),
    refreshConfiguration: vi.fn(),
  };
  const profileActions = { saveProfile: vi.fn(), deleteProfile: vi.fn(), reloadProfiles: vi.fn(), assignProfiles: vi.fn() };
  const documentActions = { loadDocuments: vi.fn(), reprocess: vi.fn(), cancel: vi.fn(), sync: vi.fn() };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    for (const group of [configurationActions, profileActions, documentActions]) Object.values(group).forEach((fn) => fn.mockReset());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows readiness items and the store address, and blocks enabling while not ready", async () => {
    await render({ configuration: configuration() });

    expect(text("fiscal-status")).toBe("Desativada");
    expect(text("fiscal-readiness")).toContain("Faltam 2 item(ns) obrigatorio(s)");
    expect(text("fiscal-readiness")).toContain("Conecte a conta do provedor");
    expect(text("fiscal-address")).toContain("Rua Augusta");
    expect(text("fiscal-address")).toContain("Obrigatorio");
    expect(checkbox("Emissao de NFC-e ativa").disabled).toBe(true);
  });

  it("starts the Bling authorization and redirects the browser", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    configurationActions.startBlingAuthorization.mockResolvedValue({
      status: "success",
      message: "Redirecionando para o Bling.",
      data: { authorizationUrl: "https://www.bling.com.br/Api/v3/oauth/authorize?state=x", expiresAt: "" },
    });
    await render({ configuration: configuration() });

    await click(button("Conectar Bling"));

    expect(assign).toHaveBeenCalledWith("https://www.bling.com.br/Api/v3/oauth/authorize?state=x");
    vi.unstubAllGlobals();
  });

  it("loads the Bling options with the suggested mapping and saves it", async () => {
    configurationActions.loadBlingOptions.mockResolvedValue({ status: "success", message: "ok", data: blingOptions() });
    configurationActions.saveBlingSettings.mockResolvedValue({ status: "success", message: "salvo", data: {} });
    configurationActions.refreshConfiguration.mockResolvedValue({ status: "success", message: "ok", data: configuration({ connected: true }) });
    await render({ configuration: configuration({ connected: true }) });

    expect(text("fiscal-connection-status")).toBe("Bling conectado");
    await click(button("Configurar natureza e pagamentos"));
    expect(select("Forma do Bling para Dinheiro").value).toBe("11508877");
    expect(text("bling-settings")).toContain("O CNPJ da conta Bling (99999999000199) e diferente do CNPJ do emitente.");

    await submit(container.querySelector("[data-testid='bling-settings']") as HTMLFormElement);

    expect(configurationActions.saveBlingSettings).toHaveBeenCalledWith({
      naturezaOperacaoId: "15111819169",
      paymentMethodMap: { CASH: "11508877", PIX_MANUAL: "11508883" },
    });
  });

  it("shows the Bling connection result from the OAuth callback", async () => {
    await render({ configuration: configuration({ connected: true }), blingResult: "connected" });
    expect(container.textContent).toContain("Conta Bling conectada.");
  });

  it("creates a fiscal profile and lists products without profile", async () => {
    profileActions.saveProfile.mockResolvedValue({ status: "success", message: "Perfil fiscal criado.", data: profile() });
    profileActions.reloadProfiles.mockResolvedValue({ status: "success", message: "ok", data: { profiles: [profile()], missing: { products: [], complements: [] } } });
    await render({ configuration: configuration(), tab: "perfis" });

    expect(text("fiscal-missing")).toContain("Hot Dog");
    await click(button("Novo perfil"));
    const form = container.querySelector("[data-testid='fiscal-profile-form']") as HTMLFormElement;
    await change(form.querySelectorAll("input")[0], "Alimentacao preparada");
    await change(form.querySelectorAll("input")[1], "2106.90.90");
    await submit(form);

    expect(profileActions.saveProfile).toHaveBeenCalledWith(null, expect.objectContaining({ name: "Alimentacao preparada", ncm: "2106.90.90", cfop: "5102", csosn: "102" }));
    expect(container.textContent).toContain("Alimentacao preparada");
  });

  it("shows assisted cancellation pending with deadline and checks the provider on demand", async () => {
    documentActions.sync.mockResolvedValue({ status: "success", message: "Situacao consultada no provedor.", data: {} });
    documentActions.loadDocuments.mockResolvedValue({ status: "success", message: "ok", data: page([]) });
    const pendingDocument = documentSummary({
      status: "CANCEL_PENDING",
      pendingReason: "CANCEL_MANUAL_REQUIRED",
      cancelDeadlineAt: new Date(Date.now() + 12 * 60_000 + 30_000).toISOString(),
      providerPanelUrl: "https://www.bling.com.br/notas.fiscais.consumidor.php",
    });
    await render({ configuration: configuration({ connected: true, enabled: true }), pending: page([pendingDocument]), tab: "pendencias" });

    const row = text("fiscal-document-row");
    expect(row).toContain("Cancelamento pendente");
    expect(row).toContain("Cancele no painel do provedor dentro do prazo");
    expect(row).toContain("faltam 12 min");
    expect(container.textContent).toContain("Pendencias1");

    await click(button("Ja cancelei no Bling"));
    expect(documentActions.sync).toHaveBeenCalledWith("doc-1");
    expect(documentActions.loadDocuments).toHaveBeenCalledWith({ pendingOnly: true, page: 1, pageSize: 25 });
  });

  it("asks for a justification before cancelling an authorized note", async () => {
    documentActions.cancel.mockResolvedValue({ status: "success", message: "Cancelamento solicitado.", data: {} });
    documentActions.loadDocuments.mockResolvedValue({ status: "success", message: "ok", data: page([]) });
    await render({ configuration: configuration({ enabled: true }), documents: page([documentSummary()]), tab: "notas" });

    expect(container.querySelector("a[href='/api/admin/fiscal/documents/doc-1/danfe']")).not.toBeNull();
    await click(button("Cancelar"));
    await submit(container.querySelector("[data-testid='fiscal-cancel-form']") as HTMLFormElement);

    expect(documentActions.cancel).toHaveBeenCalledWith("doc-1", "Venda cancelada a pedido do cliente");
  });

  it("hides configuration tabs from view-only users", async () => {
    await render({ configuration: configuration(), canConfigure: false, tab: "configuracao" });
    const tabs = [...container.querySelectorAll("[role='tab']")].map((element) => element.textContent);
    expect(tabs).toEqual(["Notas", "Pendencias"]);
    expect(container.textContent).toContain("Nenhuma pendencia fiscal.");
  });

  async function render(options: {
    configuration: FiscalConfigurationView;
    tab?: FiscalTab;
    pending?: FiscalDocumentPage;
    documents?: FiscalDocumentPage;
    canConfigure?: boolean;
    blingResult?: "connected" | "error" | null;
  }) {
    await act(async () => {
      root.render(
        <FiscalClient
          assignments={{
            categories: [{ id: "cat-1", name: "Lanches", fiscalProfileId: null }],
            products: [{ id: "prod-1", name: "Hot Dog", categoryId: "cat-1", fiscalProfileId: null }],
            complements: [],
          }}
          blingResult={options.blingResult ?? null}
          canConfigure={options.canConfigure ?? true}
          configuration={options.configuration}
          configurationActions={configurationActions}
          documentActions={documentActions}
          documents={options.documents ?? page([])}
          initialTab={options.tab ?? "configuracao"}
          missing={{ products: [{ id: "prod-1", name: "Hot Dog", categoryName: "Lanches" }], complements: [] }}
          pending={options.pending ?? page([])}
          profileActions={profileActions}
          profiles={[]}
        />
      );
    });
  }

  function text(testId: string) {
    return container.querySelector(`[data-testid='${testId}']`)?.textContent ?? "";
  }

  function button(label: string) {
    const found = [...container.querySelectorAll("button")].find((element) => element.textContent?.trim() === label);
    if (!found) throw new Error(`button ${label} not found`);
    return found as HTMLButtonElement;
  }

  function checkbox(label: string) {
    const found = [...container.querySelectorAll("label")].find((element) => element.textContent?.includes(label));
    return found?.querySelector("input[type='checkbox']") as HTMLInputElement;
  }

  function select(label: string) {
    return container.querySelector(`select[aria-label='${label}']`) as HTMLSelectElement;
  }

  async function click(element: HTMLElement) {
    await act(async () => element.click());
  }

  async function submit(form: HTMLFormElement) {
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  }

  async function change(input: HTMLInputElement, value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
});

function configuration(overrides: { connected?: boolean; enabled?: boolean } = {}): FiscalConfigurationView {
  const connected = overrides.connected ?? false;
  return {
    enabled: overrides.enabled ?? false,
    provider: "BLING",
    environment: "HOMOLOGATION",
    series: 1,
    emissionMode: "AUTOMATIC",
    eligibleSources: ["COUNTER", "IMPORT", "API"],
    defaultCancelReason: "Venda cancelada a pedido do cliente",
    issuer: {
      legalName: "Loja Teste LTDA",
      tradeName: null,
      cnpj: "11222333000181",
      stateRegistration: "110042490114",
      taxRegime: "SIMPLES_NACIONAL",
      municipalityIbgeCode: "3550308",
      municipalityIbgeSource: "IBGE_API",
    },
    address: { street: "Rua Augusta", number: "100", complement: null, neighborhood: "Consolacao", city: "Sao Paulo", state: "SP", postalCode: null },
    missingAddressFields: ["postalCode"],
    connection: {
      provider: "BLING",
      status: connected ? "CONNECTED" : "DRAFT",
      connectedAt: null,
      lastErrorMessage: null,
      capabilities: { cancelViaApi: false, usesOwnCertificate: false },
    },
    certificate: null,
    readiness: {
      ready: connected,
      items: [
        { key: "ISSUER", ok: true, blocking: true, message: "Dados do emitente informados" },
        { key: "ADDRESS", ok: connected, blocking: true, message: "Complete o endereco da loja: CEP" },
        { key: "CONNECTION", ok: connected, blocking: true, message: connected ? "Provedor conectado" : "Conecte a conta do provedor" },
        { key: "CERTIFICATE", ok: false, blocking: false, message: "Certificado A1 nao enviado" },
      ],
    },
    updatedAt: null,
  };
}

function blingOptions(): BlingConnectionOptions {
  return {
    paymentForms: [
      { id: "11508877", name: "Dinheiro", tPag: "01" },
      { id: "11508883", name: "Pix", tPag: "20" },
    ],
    operationNatures: [{ id: "15111819169", name: "Venda de mercadoria a nao contribuinte", defaultForSales: true }],
    paymentMethods: [
      { method: "CASH", label: "Dinheiro", tPag: "01" },
      { method: "PIX_MANUAL", label: "Pix manual", tPag: "20" },
    ],
    current: { naturezaOperacaoId: null, paymentMethodMap: {} },
    suggested: { naturezaOperacaoId: "15111819169", paymentMethodMap: { CASH: "11508877", PIX_MANUAL: "11508883" } },
    account: { name: "Loja", cnpj: "99999999000199" },
  };
}

function profile(): FiscalProfileView {
  return {
    id: "profile-1",
    name: "Alimentacao preparada",
    ncm: "21069090",
    cfop: "5102",
    csosn: "102",
    origin: 0,
    commercialUnit: "UN",
    cest: null,
    benefitCode: null,
    active: true,
    usage: { categories: 0, products: 0, complements: 0 },
  };
}

function documentSummary(overrides: Partial<FiscalDocumentSummary> = {}): FiscalDocumentSummary {
  return {
    id: "doc-1",
    target: { type: "ORDER", id: "order-1", publicCode: "B12" },
    status: "AUTHORIZED",
    trigger: "AUTOMATIC",
    environment: "HOMOLOGATION",
    number: 4,
    series: 1,
    accessKey: "35261011222333000181650010000000041689756832",
    totalAmount: "28.00",
    saleOccurredAt: new Date().toISOString(),
    authorizedAt: new Date().toISOString(),
    rejectionCode: null,
    rejectionMessage: null,
    cancelDeadlineAt: null,
    pendingReason: null,
    providerPanelUrl: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function page(items: FiscalDocumentSummary[]): FiscalDocumentPage {
  return { items, page: 1, pageSize: 25, total: items.length };
}
