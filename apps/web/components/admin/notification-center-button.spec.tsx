import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNotifications } from "../../lib/api";
import { readAuthSession } from "../../lib/auth-client";
import { NotificationCenterButton } from "./notification-center-button";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../lib/api", () => ({
  getNotifications: vi.fn(),
}));

vi.mock("../../lib/auth-client", () => ({
  readAuthSession: vi.fn(),
}));

const getNotificationsMock = vi.mocked(getNotifications);
const readAuthSessionMock = vi.mocked(readAuthSession);

describe("NotificationCenterButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getNotificationsMock.mockReset();
    readAuthSessionMock.mockReset();
    readAuthSessionMock.mockReturnValue({
      accessToken: "token",
      user: {
        id: "user-1",
        login: "admin",
        name: "Admin",
        email: "admin@example.com",
        status: "ACTIVE",
        isMaster: true,
      },
      activeStoreId: null,
      allowedStores: [],
      permissions: [],
      accessTokenExpiresAt: "2026-06-30T00:00:00.000Z",
    });
    getNotificationsMock.mockResolvedValue({ unreadCount: 3, items: [] });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.useRealTimers();
    container.remove();
  });

  it("loads unread count and links to notification center", async () => {
    await act(async () => {
      root.render(<NotificationCenterButton />);
      await Promise.resolve();
    });

    expect(getNotificationsMock).toHaveBeenCalledWith("token", { limit: 1 });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/admin/notifications");
    expect(container.textContent).toContain("3");
  });

  it("caps the visible unread badge", async () => {
    getNotificationsMock.mockResolvedValue({ unreadCount: 12, items: [] });

    await act(async () => {
      root.render(<NotificationCenterButton />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("9+");
  });

  it("refreshes unread count while the user stays on the page", async () => {
    vi.useFakeTimers();
    getNotificationsMock
      .mockResolvedValueOnce({ unreadCount: 0, items: [] })
      .mockResolvedValueOnce({ unreadCount: 2, items: [] });

    await act(async () => {
      root.render(<NotificationCenterButton />);
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("2");

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(getNotificationsMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("2");
  });
});
