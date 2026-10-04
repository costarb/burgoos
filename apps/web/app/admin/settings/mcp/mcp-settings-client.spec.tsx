import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreatedMcpToken,
  McpConfiguration,
  McpConnection,
  McpToken,
  McpUsageEntry,
  McpUsagePage,
} from "@rrfive/types";
import { McpSettingsClient } from "./mcp-settings-client";

describe("McpSettingsClient", () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveConfigurationAction = vi.fn();
  const createTokenAction = vi.fn();
  const revokeTokenAction = vi.fn();
  const loadUsageAction = vi.fn();
  const revokeConnectionAction = vi.fn();

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveConfigurationAction.mockReset();
    createTokenAction.mockReset();
    revokeTokenAction.mockReset();
    loadUsageAction.mockReset();
    revokeConnectionAction.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the disabled state and blocks token generation", async () => {
    await render(configuration({ enabled: false }), []);

    expect(text("mcp-status")).toBe("Desabilitado");
    expect(container.textContent).toContain("Habilite o MCP para gerar tokens.");
    expect(button("Gerar token").disabled).toBe(true);
    expect(container.textContent).toContain("Nenhum token gerado.");
  });

  it("enables the MCP keeping every area", async () => {
    saveConfigurationAction.mockResolvedValue({
      status: "success",
      message: "Configuracao do MCP salva.",
      data: configuration({ enabled: true }),
    });
    await render(configuration({ enabled: false }), []);

    await click(button("Habilitar"));

    expect(saveConfigurationAction).toHaveBeenCalledWith({
      enabled: true,
      enabledAreas: ["SALES", "FINANCIAL", "MENU", "CASH", "PAYABLES", "INVENTORY"],
    });
    expect(text("mcp-status")).toBe("Habilitado");
  });

  it("lets the owner allow actions, keeping the areas, and shows the access of each connection", async () => {
    saveConfigurationAction.mockResolvedValue({
      status: "success",
      message: "Configuracao do MCP salva.",
      data: configuration({ enabled: true, actionsEnabled: true }),
    });
    await render(configuration({ enabled: true }), [], usagePage([]), [
      connection(),
      connection({ id: "conn-2", actions: true }),
    ]);

    expect(text("mcp-actions-status")).toContain("Acoes desligadas");
    expect(
      [...container.querySelectorAll('[data-testid="connection-access"]')].map(
        (item) => item.textContent
      )
    ).toEqual(["Leitura", "Leitura e acoes"]);

    await click(button("Permitir acoes"));
    expect(saveConfigurationAction).toHaveBeenCalledWith({
      enabled: true,
      enabledAreas: ["SALES", "FINANCIAL", "MENU", "CASH", "PAYABLES", "INVENTORY"],
      actionsEnabled: true,
    });
    expect(text("mcp-actions-status")).toContain("Acoes permitidas");
  });

  it("keeps the actions switch disabled while the MCP is off", async () => {
    await render(configuration({ enabled: false }), []);
    expect(button("Permitir acoes").disabled).toBe(true);
  });

  it("shows the generated token once with client snippets, then only the prefix", async () => {
    createTokenAction.mockResolvedValue({
      status: "success",
      message: "Token gerado.",
      data: createdToken(),
    });
    await render(configuration({ enabled: true }), []);

    await type(input("Nome do token"), "Notebook do gerente");
    await select(input("Validade") as unknown as HTMLSelectElement, "never");
    await click(button("Gerar token"));

    expect(createTokenAction).toHaveBeenCalledWith({
      name: "Notebook do gerente",
      expiresInDays: null,
    });
    expect(text("mcp-created-token")).toBe("rrf_mcp_SECRET-VALUE");
    expect(text("mcp-snippet")).toContain("claude mcp add");

    await click(button("Cursor"));
    expect(text("mcp-snippet")).toContain('"url"');

    await click(button("Fechar"));
    expect(container.querySelector('[data-testid="mcp-created-token"]')).toBeNull();
    expect(container.textContent).not.toContain("rrf_mcp_SECRET-VALUE");
    expect(container.textContent).toContain("rrf_mcp_SECRET…");
    expect(container.textContent).toContain("Notebook do gerente");
  });

  it("requires a token name", async () => {
    await render(configuration({ enabled: true }), []);

    await click(button("Gerar token"));

    expect(createTokenAction).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Informe um nome para identificar o token.");
  });

  it("revokes a token after confirmation", async () => {
    revokeTokenAction.mockResolvedValue({
      status: "success",
      message: "Token revogado.",
      data: token({ status: "REVOKED", revokedAt: "2026-10-01T12:00:00.000Z" }),
    });
    await render(configuration({ enabled: true }), [token()]);

    await click(button("Revogar"));
    expect(container.textContent).toContain("Revogar token?");
    await click(button("Revogar token"));

    expect(revokeTokenAction).toHaveBeenCalledWith("token-1");
    expect(container.textContent).toContain("Revogado");
    expect(container.textContent).not.toContain("Revogar token?");
  });

  it("shows the token limit error returned by the API", async () => {
    createTokenAction.mockResolvedValue({
      status: "error",
      message: "A loja ja possui 10 tokens ativos. Revogue tokens sem uso para gerar outro.",
    });
    await render(configuration({ enabled: true }), [token()]);

    await type(input("Nome do token"), "Excedente");
    await click(button("Gerar token"));

    expect(container.textContent).toContain("A loja ja possui 10 tokens ativos");
  });

  it("toggles data areas and keeps at least one active", async () => {
    saveConfigurationAction.mockResolvedValue({
      status: "success",
      message: "ok",
      data: configuration({ enabled: true, enabledAreas: ["SALES"] }),
    });
    await render(configuration({ enabled: true, enabledAreas: ["SALES", "INVENTORY"] }), []);

    await click(input("Area Estoque"));
    expect(saveConfigurationAction).toHaveBeenCalledWith({
      enabled: true,
      enabledAreas: ["SALES"],
    });

    saveConfigurationAction.mockClear();
    await click(input("Area Vendas"));
    expect(saveConfigurationAction).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Mantenha ao menos uma area de dados ativa");
  });

  it("refreshes the usage log keeping the current filters and page", async () => {
    loadUsageAction
      .mockResolvedValueOnce({
        status: "success",
        message: "ok",
        data: usagePage([usageEntry({ result: "DENIED" })]),
      })
      .mockResolvedValueOnce({
        status: "success",
        message: "ok",
        data: usagePage([
          usageEntry({ id: "call-new", target: "dre", result: "DENIED" }),
          usageEntry({ result: "DENIED" }),
        ]),
      });
    await render(configuration({ enabled: true }), [], usagePage([usageEntry()]));
    await click(button("Uso"));
    await select(input("Filtrar por resultado") as unknown as HTMLSelectElement, "DENIED");

    expect(container.textContent).toContain("Atualizado as");
    await click(button("Atualizar"));

    expect(loadUsageAction).toHaveBeenLastCalledWith({ result: "DENIED", page: 1, pageSize: 25 });
    expect(container.textContent).toContain("dre");
    expect(container.textContent).toContain("2 chamada(s)");
  });

  it("shows the usage log with refusals and filters by result", async () => {
    loadUsageAction.mockResolvedValue({
      status: "success",
      message: "ok",
      data: usagePage([usageEntry({ id: "call-2", result: "DENIED", errorCode: "TOKEN_REVOKED" })]),
    });
    await render(configuration({ enabled: true }), [token()], usagePage([usageEntry()]));

    await click(button("Uso"));
    expect(container.textContent).toContain("Uso do MCP");
    expect(container.textContent).toContain("resumo_vendas");
    expect(container.textContent).toContain("Sucesso");
    expect(container.textContent).toContain("1 chamada(s)");

    await select(input("Filtrar por resultado") as unknown as HTMLSelectElement, "DENIED");

    expect(loadUsageAction).toHaveBeenCalledWith({ result: "DENIED", page: 1, pageSize: 25 });
    expect(container.textContent).toContain("Recusada");
    expect(container.textContent).toContain("Token revogado");
  });

  it("shows an empty usage state", async () => {
    await render(configuration({ enabled: true }), [], usagePage([]));
    await click(button("Uso"));
    expect(container.textContent).toContain("Nenhuma chamada registrada.");
  });

  it("shows the server address and the steps per client", async () => {
    await render(configuration({ enabled: true }), []);

    expect(text("mcp-server-url")).toBe("https://api.example.com/api/mcp");
    expect(text("mcp-connect-steps")).toContain("Adicionar conector personalizado");
    await click(button("ChatGPT"));
    expect(text("mcp-connect-steps")).toContain("autenticacao OAuth");
    expect(container.textContent).toContain("Tokens de acesso (avancado)");
  });

  it("lists authorized connections and revokes one after confirmation", async () => {
    revokeConnectionAction.mockResolvedValue({
      status: "success",
      message: "Conexao revogada.",
      data: connection({
        status: "REVOKED",
        revokedAt: "2026-10-02T12:00:00.000Z",
        revokedReason: "MANUAL",
      }),
    });
    await render(configuration({ enabled: true }), [], usagePage([]), [connection()]);

    expect(container.textContent).toContain("Conexoes autorizadas");
    expect(container.textContent).toContain("1 de 20 ativas");
    expect(container.textContent).toContain("Dono Centro");
    await click(button("Revogar"));
    expect(container.textContent).toContain("Revogar conexao?");
    await click(button("Revogar conexao"));

    expect(revokeConnectionAction).toHaveBeenCalledWith("conn-1");
    expect(container.textContent).toContain("Revogada na tela");
    expect(container.textContent).not.toContain("Revogar conexao?");
  });

  it("shows OAuth calls in the usage log by app and user", async () => {
    await render(
      configuration({ enabled: true }),
      [],
      usagePage([
        usageEntry({
          tokenName: null,
          connectionId: "conn-1",
          clientName: "Claude",
          userName: "Dono Centro",
        }),
      ])
    );
    await click(button("Uso"));
    expect(container.textContent).toContain("Claude");
    expect(container.textContent).toContain("Dono Centro");
  });

  async function render(
    config: McpConfiguration,
    tokens: McpToken[],
    usage = usagePage([]),
    connections: McpConnection[] = []
  ) {
    await act(async () => {
      root.render(
        <McpSettingsClient
          configuration={config}
          createTokenAction={createTokenAction}
          loadUsageAction={loadUsageAction}
          revokeTokenAction={revokeTokenAction}
          saveConfigurationAction={saveConfigurationAction}
          tokens={tokens}
          usage={usage}
          connections={connections}
          revokeConnectionAction={revokeConnectionAction}
        />
      );
    });
  }

  function text(testId: string): string {
    return container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label
    );
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
  }

  function input(label: string): HTMLInputElement {
    const found = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
    if (!found) throw new Error(`Input not found: ${label}`);
    return found;
  }

  async function click(element: HTMLElement) {
    await act(async () => {
      element.click();
    });
  }

  async function type(element: HTMLInputElement, value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function select(element: HTMLSelectElement, value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
});

function configuration(overrides: Partial<McpConfiguration> = {}): McpConfiguration {
  return {
    enabled: false,
    enabledAreas: ["SALES", "FINANCIAL", "MENU", "CASH", "PAYABLES", "INVENTORY"],
    actionsEnabled: false,
    availableAreas: [
      { area: "SALES", label: "Vendas", description: "Vendas", tools: ["resumo_vendas"] },
      { area: "FINANCIAL", label: "Financeiro/DRE", description: "DRE", tools: ["dre"] },
      {
        area: "MENU",
        label: "Cardapio e Margem",
        description: "Menu",
        tools: ["engenharia_cardapio"],
      },
      { area: "CASH", label: "Caixa", description: "Caixa", tools: ["posicao_caixa"] },
      {
        area: "PAYABLES",
        label: "Contas a pagar",
        description: "Contas",
        tools: ["contas_a_pagar"],
      },
      { area: "INVENTORY", label: "Estoque", description: "Estoque", tools: ["estoque"] },
    ],
    serverUrl: "https://api.example.com/api/mcp",
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  };
}

function token(overrides: Partial<McpToken> = {}): McpToken {
  return {
    id: "token-1",
    name: "Notebook",
    tokenPrefix: "rrf_mcp_abc123",
    status: "ACTIVE",
    expiresAt: null,
    lastUsedAt: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    createdBy: "Admin",
    revokedAt: null,
    ...overrides,
  };
}

function createdToken(): CreatedMcpToken {
  return {
    ...token({ id: "token-new", name: "Notebook do gerente", tokenPrefix: "rrf_mcp_SECRET" }),
    token: "rrf_mcp_SECRET-VALUE",
    snippets: {
      inspector: "npx @modelcontextprotocol/inspector",
      claudeCode: "claude mcp add --transport http rrfive https://api.example.com/api/mcp",
      claudeDesktop: '{"mcpServers":{}}',
      claudeDesktopWindows: '{"mcpServers":{}}',
      cursor: '{"mcpServers":{"rrfive":{"url":"https://api.example.com/api/mcp"}}}',
    },
  };
}

function usageEntry(overrides: Partial<McpUsageEntry> = {}): McpUsageEntry {
  return {
    id: "call-1",
    occurredAt: "2026-10-01T12:00:00.000Z",
    tokenName: "Notebook",
    tokenPrefix: "rrf_mcp_abc123",
    connectionId: null,
    clientName: null,
    userName: null,
    method: "tools/call",
    target: "resumo_vendas",
    arguments: { inicio: "2026-09-01" },
    result: "SUCCESS",
    errorCode: null,
    durationMs: 120,
    isAction: false,
    ...overrides,
  };
}

function usagePage(items: McpUsageEntry[]): McpUsagePage {
  return { page: 1, pageSize: 25, total: items.length, items };
}

function connection(overrides: Partial<McpConnection> = {}): McpConnection {
  return {
    id: "conn-1",
    clientName: "Claude",
    clientKind: "CIMD",
    redirectHost: "claude.ai",
    userName: "Dono Centro",
    status: "ACTIVE",
    actions: false,
    createdAt: "2026-10-02T10:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  };
}
