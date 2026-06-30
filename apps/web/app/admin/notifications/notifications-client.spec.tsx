import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationCenterState } from "@burgoos/types";
import { markNotificationRead } from "../../../lib/api";
import { NotificationsClient } from "./notifications-client";

vi.mock("../../../lib/api", () => ({
  markNotificationRead: vi.fn(),
}));

const markNotificationReadMock = vi.mocked(markNotificationRead);

describe("NotificationsClient", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    markNotificationReadMock.mockReset();
    markNotificationReadMock.mockResolvedValue({
      ...notification(),
      status: "READ",
      readAt: "2026-06-30T12:10:00.000Z",
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders unread count, action link and marks a notification as read", async () => {
    await renderClient(state());

    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("Exportacao concluida");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/api/admin/exports/export-1/download"
    );

    await clickButton("Marcar lida");

    expect(markNotificationReadMock).toHaveBeenCalledWith("token", "notification-1");
    expect(container.textContent).toContain("0");
    expect(container.textContent).not.toContain("Nova");
  });

  it("renders empty state", async () => {
    await renderClient({ unreadCount: 0, items: [] });

    expect(container.textContent).toContain("Nenhuma notificacao encontrada.");
  });

  async function renderClient(initialState: NotificationCenterState) {
    await act(async () => {
      root.render(<NotificationsClient initialState={initialState} token="token" />);
    });
  }

  async function clickButton(label: string) {
    await act(async () => {
      const found = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === label
      );

      if (!found) {
        throw new Error(`Button "${label}" not found`);
      }

      found.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
  }
});

function state(): NotificationCenterState {
  return {
    unreadCount: 1,
    items: [notification()],
  };
}

function notification() {
  return {
    id: "notification-1",
    type: "PAYABLE_EXPORT_COMPLETED",
    status: "UNREAD" as const,
    severity: "SUCCESS" as const,
    title: "Exportacao concluida",
    message: "O arquivo contas-a-pagar.csv esta pronto para download.",
    actionLabel: "Baixar arquivo",
    actionUrl: "/api/admin/exports/export-1/download",
    relatedEntityType: "export_job",
    relatedEntityId: "export-1",
    createdAt: "2026-06-30T12:00:00.000Z",
    readAt: null,
  };
}
