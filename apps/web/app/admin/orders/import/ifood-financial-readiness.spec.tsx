import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IfoodReadinessSummary } from "./ifood-financial-panel";

describe("iFood financial readiness UI", () => {
  it("shows a pending-permission state with a recovery action and no production gate", () => {
    const html = renderToStaticMarkup(
      <IfoodReadinessSummary
        busy={false}
        onRevalidate={() => undefined}
        readiness={{
          integrationId: "integration",
          status: "PENDING_PERMISSION",
          environment: "PRODUCTION",
          merchantId: "merchant-1",
          permissions: [],
          productionEnabled: false,
          lastValidatedAt: null,
          checks: [
            { code: "MERCHANT_LINK", passed: true, message: null },
            {
              code: "FINANCIAL_PERMISSION",
              passed: false,
              message: "Aguardando propagacao da permissao",
            },
          ],
        }}
      />
    );
    expect(html).toContain("Permissao financeira em propagacao");
    expect(html).toContain("Validar novamente");
    expect(html).toContain("Aguardando propagacao da permissao");
    expect(html).toContain("bloqueada");
  });

  it("shows required attention with a safe recovery message and no destroyed connection", () => {
    const html = renderToStaticMarkup(
      <IfoodReadinessSummary
        busy={false}
        onRevalidate={() => undefined}
        readiness={{
          integrationId: "integration",
          status: "REQUIRES_ATTENTION",
          environment: "PRODUCTION",
          merchantId: "merchant-1",
          permissions: [],
          productionEnabled: false,
          lastValidatedAt: "2026-09-04T00:00:00.000Z",
          checks: [
            {
              code: "FINANCIAL_PERMISSION",
              passed: false,
              message: "Credencial financeira iFood expirada ou invalida",
            },
          ],
        }}
      />
    );
    expect(html).toContain("Requer atencao");
    expect(html).toContain("Nenhum dado historico foi");
    expect(html).toContain("Credencial financeira iFood expirada ou invalida");
  });

  it("unlocks production only once every readiness check has passed", () => {
    const html = renderToStaticMarkup(
      <IfoodReadinessSummary
        busy={false}
        onRevalidate={() => undefined}
        readiness={{
          integrationId: "integration",
          status: "READY_PRODUCTION",
          environment: "PRODUCTION",
          merchantId: "merchant-1",
          permissions: [],
          productionEnabled: true,
          lastValidatedAt: "2026-09-04T00:00:00.000Z",
          checks: [{ code: "SALES_EVIDENCE", passed: true, message: null }],
        }}
      />
    );
    expect(html).toContain("Pronta para producao");
    expect(html).toContain("liberada");
  });

  it("renders a waiting state before the first readiness response arrives", () => {
    const html = renderToStaticMarkup(
      <IfoodReadinessSummary readiness={null} busy={false} onRevalidate={() => undefined} />
    );
    expect(html).toContain("Validando acesso financeiro");
  });
});
