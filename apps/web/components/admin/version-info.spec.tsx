import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatVersionTime } from "../../lib/app-version";

const api = vi.hoisted(() => ({ getApiVersion: vi.fn() }));
vi.mock("../../lib/api", async (original) => ({ ...(await original<Record<string, unknown>>()), ...api }));
vi.mock("../../lib/app-version", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  WEB_VERSION: { commit: "6d79320", builtAt: "2026-11-16T20:18:00.000Z" },
}));

import { VersionInfo } from "./version-info";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<VersionInfo />));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});

describe("VersionInfo", () => {
  it("shows web and API commits with their times", async () => {
    api.getApiVersion.mockResolvedValue({ commit: "6d79320", branch: "main", startedAt: "2026-11-16T20:18:11.000Z" });
    const view = await render();
    expect(view.textContent).toContain("Web 6d79320 · 16/11 17:18");
    expect(view.textContent).toContain("API 6d79320 · 16/11 17:18");
    expect(view.textContent).not.toContain("Versoes diferentes");
  });

  it("warns when the services run different commits and when the API does not answer", async () => {
    api.getApiVersion.mockResolvedValue({ commit: "aa15fe8", branch: "main", startedAt: "2026-11-16T19:01:44.000Z" });
    expect((await render()).textContent).toContain("Versoes diferentes");
    act(() => root?.unmount());

    api.getApiVersion.mockResolvedValue(null);
    expect((await render()).textContent).toContain("API indisponivel");
  });

  it("formats times in the store time zone", () => {
    expect(formatVersionTime("2026-11-17T02:30:00.000Z")).toBe("16/11 23:30");
    expect(formatVersionTime(null)).toBe("");
  });
});
