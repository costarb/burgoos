import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlatformUsersPage from "./page";

vi.mock("../../../lib/api", () => ({
  getPlatformAdminToken: vi.fn(async () => "platform-token"),
  listPlatformUsers: vi.fn(async () => [
    {
      id: "platform-admin-id",
      name: "Admin Plataforma",
      email: "platform@burgoos.local",
      role: "SUPER_ADMIN",
      active: true,
      createdAt: "2026-07-08T12:00:00.000Z",
      updatedAt: "2026-07-08T12:00:00.000Z",
    },
  ]),
}));

describe("PlatformUsersPage", () => {
  it("renders platform user maintenance actions", async () => {
    const html = renderToStaticMarkup(
      await PlatformUsersPage({
        searchParams: {},
      })
    );

    expect(html).toContain("Admins da plataforma");
    expect(html).toContain("Admin Plataforma");
    expect(html).toContain("Novo admin");
    expect(html).toContain("Editar");
    expect(html).toContain("Desativar");
  });
});
