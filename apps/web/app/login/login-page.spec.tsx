import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";
import { writeAuthSession } from "../../lib/auth-client";

const locationAssign = vi.fn();

vi.mock("../../lib/auth-client", () => ({
  writeAuthSession: vi.fn(),
}));

describe("login page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
    vi.stubGlobal("location", {
      ...window.location,
      assign: locationAssign,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders login form fields and first state", async () => {
    await act(async () => {
      root.render(<LoginPage />);
    });

    expect(container.textContent).toContain("BurgoOS");
    expect(container.querySelector('input[name="email"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.textContent).toContain("Entrar");
  });

  it("shows invalid credential feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }))
    );

    await act(async () => {
      root.render(<LoginPage />);
    });
    await fillAndSubmit();

    expect(container.textContent).toContain("Credenciais invalidas");
    expect(writeAuthSession).not.toHaveBeenCalled();
  });

  it("stores multi-store session and redirects to admin", async () => {
    const session = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      activeStoreId: "11111111-1111-4111-8111-111111111111",
      allowedStores: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Loja Centro",
          slug: "loja-centro",
          active: true,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Loja Filial",
          slug: "loja-filial",
          active: true,
        },
      ],
      permissions: ["access.users.manage"],
      accessTokenExpiresAt: "2026-06-10T22:15:00.000Z",
      user: {
        id: "33333333-3333-4333-8333-333333333333",
        login: "admin@example.com",
        name: "Admin",
        email: "admin@example.com",
        status: "ACTIVE",
        isMaster: true,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => session,
      }))
    );

    await act(async () => {
      root.render(<LoginPage />);
    });
    await fillAndSubmit();

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/auth/login",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(writeAuthSession).toHaveBeenCalledWith(session);
    expect(locationAssign).toHaveBeenCalledWith("/admin");
  });

  it("falls back to platform login and redirects platform admins to stores", async () => {
    const session = {
      accessToken: "platform-access-token",
      refreshToken: "platform-refresh-token",
      activeStoreId: null,
      allowedStores: [],
      permissions: [],
      accessTokenExpiresAt: "2026-06-10T22:15:00.000Z",
      user: {
        id: "platform-user-1",
        login: "platform@burgoos.local",
        name: "Admin Plataforma",
        email: "platform@burgoos.local",
        status: "ACTIVE",
        isMaster: true,
        isPlatformAdmin: true,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => session,
        })
    );

    await act(async () => {
      root.render(<LoginPage />);
    });
    await fillAndSubmit("platform@burgoos.local", "admin123");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3001/api/auth/login",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3001/api/auth/platform/login",
      expect.objectContaining({ method: "POST" })
    );
    expect(writeAuthSession).toHaveBeenCalledWith(session);
    expect(locationAssign).toHaveBeenCalledWith("/platform/stores");
  });

  async function fillAndSubmit(emailValue = "admin@example.com", passwordValue = "admin123") {
    const email = container.querySelector<HTMLInputElement>('input[name="email"]');
    const password = container.querySelector<HTMLInputElement>('input[name="password"]');
    const form = container.querySelector<HTMLFormElement>("form");

    await act(async () => {
      email!.value = emailValue;
      email!.dispatchEvent(new Event("input", { bubbles: true }));
      password!.value = passwordValue;
      password!.dispatchEvent(new Event("input", { bubbles: true }));
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }
});
