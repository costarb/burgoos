import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { McpAuthorizationRequest } from "@rrfive/types";
import { refreshAuthSessionIfNeeded } from "../../../lib/auth-client";
import {
  approveMcpAuthorization,
  denyMcpAuthorization,
  getMcpAuthorizationRequest,
  McpConsentError,
} from "../../../lib/mcp-consent-api";
import { McpConsentClient } from "./mcp-consent-client";

vi.mock("../../../lib/auth-client", () => ({ refreshAuthSessionIfNeeded: vi.fn() }));
vi.mock("../../../lib/mcp-consent-api", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/mcp-consent-api")>(
    "../../../lib/mcp-consent-api"
  );
  return {
    McpConsentError: actual.McpConsentError,
    getMcpAuthorizationRequest: vi.fn(),
    approveMcpAuthorization: vi.fn(),
    denyMcpAuthorization: vi.fn(),
  };
});

const sessionMock = vi.mocked(refreshAuthSessionIfNeeded);
const getRequestMock = vi.mocked(getMcpAuthorizationRequest);
const approveMock = vi.mocked(approveMcpAuthorization);
const denyMock = vi.mocked(denyMcpAuthorization);
const assign = vi.fn();

describe("McpConsentClient", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/conectar/mcp",
      search: "?pedido=req-1",
      assign,
    });
    sessionMock.mockResolvedValue({ accessToken: "jwt" } as never);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("sends users without a session to the login with a return path", async () => {
    sessionMock.mockResolvedValue(null);
    await render();
    expect(assign).toHaveBeenCalledWith("/login?next=%2Fconectar%2Fmcp%3Fpedido%3Dreq-1");
    expect(getRequestMock).not.toHaveBeenCalled();
  });

  it("shows the client, the return host and preselects a single store", async () => {
    getRequestMock.mockResolvedValue(request());
    approveMock.mockResolvedValue({
      redirectUrl: "https://claude.ai/api/mcp/auth_callback?code=c&state=s",
    });
    await render();

    expect(getRequestMock).toHaveBeenCalledWith("jwt", "req-1");
    expect(text("consent-client")).toBe("Claude quer acessar os numeros da sua loja");
    expect(text("consent-host")).toBe("claude.ai");
    expect(text("consent-areas")).toContain("Vendas, Financeiro/DRE");
    expect(container.textContent).not.toContain("roda no seu computador");

    await click(button("Autorizar"));
    expect(approveMock).toHaveBeenCalledWith("jwt", "req-1", "store-a", false);
    expect(assign).toHaveBeenCalledWith("https://claude.ai/api/mcp/auth_callback?code=c&state=s");
    expect(container.textContent).toContain("Voltando para Claude");
  });

  it("offers actions unchecked and grants them only when the user opts in", async () => {
    const withActions = {
      ...store("store-a", "Loja Centro"),
      actions: [
        { group: "PAYABLES" as const, label: "criar, pagar, editar e cancelar contas a pagar" },
      ],
    };
    getRequestMock.mockResolvedValue(request({ stores: [withActions] }));
    approveMock.mockResolvedValue({ redirectUrl: "https://claude.ai/cb?code=c" });
    await render();

    const checkbox = container.querySelector<HTMLInputElement>(
      'input[aria-label="Permitir que o assistente execute acoes"]'
    )!;
    expect(checkbox.checked).toBe(false);
    expect(text("consent-actions")).toContain("criar, pagar, editar e cancelar contas a pagar");
    expect(container.textContent).toContain("O assistente nao altera nada");

    await click(checkbox);
    expect(container.textContent).toContain("Acoes apenas as marcadas abaixo");
    await click(button("Autorizar"));
    expect(approveMock).toHaveBeenCalledWith("jwt", "req-1", "store-a", true);
  });

  it("does not show the actions option when the store or the user cannot grant them", async () => {
    getRequestMock.mockResolvedValue(request());
    await render();
    expect(
      container.querySelector('input[aria-label="Permitir que o assistente execute acoes"]')
    ).toBeNull();
  });

  it("requires choosing among several stores", async () => {
    getRequestMock.mockResolvedValue(
      request({ stores: [store("store-a", "Loja Centro"), store("store-b", "Loja Sul")] })
    );
    approveMock.mockResolvedValue({ redirectUrl: "https://claude.ai/cb?code=c" });
    await render();

    expect(button("Autorizar").disabled).toBe(true);
    await click(container.querySelector<HTMLInputElement>('[aria-label="Loja Loja Sul"]')!);
    await click(button("Autorizar"));
    expect(approveMock).toHaveBeenCalledWith("jwt", "req-1", "store-b", false);
  });

  it("cancels back to the client", async () => {
    getRequestMock.mockResolvedValue(request());
    denyMock.mockResolvedValue({ redirectUrl: "https://claude.ai/cb?error=access_denied" });
    await render();

    await click(button("Cancelar"));
    expect(denyMock).toHaveBeenCalledWith("jwt", "req-1");
    expect(assign).toHaveBeenCalledWith("https://claude.ai/cb?error=access_denied");
  });

  it.each([
    ["MISSING_PERMISSION", "Usar assistentes de IA"],
    ["NO_ELIGIBLE_STORE", "Configuracoes > MCP / IA"],
    ["PLATFORM_ADMIN", "Contas de administracao da plataforma"],
  ] as const)(
    "explains a blocked request (%s) without the authorize button",
    async (reason, message) => {
      getRequestMock.mockResolvedValue(
        request({ canAuthorize: false, blockedReason: reason, stores: [] })
      );
      await render();
      expect(container.textContent).toContain(message);
      expect(
        [...container.querySelectorAll("button")].some((item) => item.textContent === "Autorizar")
      ).toBe(false);
    }
  );

  it("warns about loopback-only clients", async () => {
    getRequestMock.mockResolvedValue(
      request({
        client: {
          name: "Claude Code",
          redirectHost: "localhost:3118",
          kind: "CIMD",
          loopbackOnly: true,
        },
      })
    );
    await render();
    expect(container.textContent).toContain("roda no seu computador");
  });

  it("shows expired requests and the connection limit", async () => {
    getRequestMock.mockRejectedValueOnce(new McpConsentError(410, "expirou"));
    await render();
    expect(container.textContent).toContain("Este pedido de autorizacao expirou");

    getRequestMock.mockResolvedValue(request());
    approveMock.mockRejectedValue(
      new McpConsentError(409, "A loja ja possui 20 conexoes ativas.", "CONNECTION_LIMIT_REACHED")
    );
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    await click(button("Autorizar"));
    expect(container.textContent).toContain("A loja ja possui 20 conexoes ativas.");
    expect(assign).not.toHaveBeenCalled();
  });

  async function render() {
    await act(async () => {
      root.render(<McpConsentClient />);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  function text(testId: string) {
    return container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label
    );
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
  }

  async function click(element: HTMLElement) {
    await act(async () => {
      element.click();
    });
  }
});

function store(id: string, name: string) {
  return {
    id,
    name,
    areas: [
      { area: "SALES" as const, label: "Vendas" },
      { area: "FINANCIAL" as const, label: "Financeiro/DRE" },
    ],
    actions: [] as Array<{ group: "PAYABLES" | "SALES_IMPORT"; label: string }>,
  };
}

function request(overrides: Partial<McpAuthorizationRequest> = {}): McpAuthorizationRequest {
  return {
    id: "req-1",
    client: { name: "Claude", redirectHost: "claude.ai", kind: "CIMD", loopbackOnly: false },
    scopeDescription: "Somente leitura dos numeros da loja",
    expiresAt: "2026-10-02T15:10:00.000Z",
    canAuthorize: true,
    blockedReason: null,
    stores: [store("store-a", "Loja Centro")],
    ...overrides,
  };
}
