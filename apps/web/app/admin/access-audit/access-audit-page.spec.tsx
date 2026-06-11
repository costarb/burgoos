import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccessAuditPage from "./page";

vi.mock("../../../lib/api", () => ({
  getAccessAudit: vi.fn(async () => ({
    stores: [{ id: "store-1", name: "Loja Centro", slug: "loja-centro", active: true }],
    events: [
      {
        id: "audit-1",
        actorUserId: "admin-1",
        targetUserId: "user-1",
        storeId: "store-1",
        eventType: "ACCESS_DENIED",
        result: "DENIED",
        reason: "STORE_ADMIN_ASSIGNMENT_SCOPE",
        occurredAt: "2026-06-10T20:00:00.000Z",
      },
    ],
  })),
}));

describe("access audit page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
  });

  it("renders filters and scoped audit rows", async () => {
    const page = await AccessAuditPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Auditoria de acessos");
    expect(html).toContain("Todos os eventos");
    expect(html).toContain("Todas as lojas");
    expect(html).toContain("Loja Centro");
    expect(html).toContain("ACCESS_DENIED");
    expect(html).toContain("DENIED");
    expect(html).toContain("Ver");
  });
});
