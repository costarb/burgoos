import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNotificationSummary } from "../../lib/api";
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
  getNotificationSummary: vi.fn(),
}));

vi.mock("../../lib/auth-client", () => ({
  readAuthSession: vi.fn(),
}));

const getNotificationSummaryMock = vi.mocked(getNotificationSummary);
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
    getNotificationSummaryMock.mockReset();
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
    getNotificationSummaryMock.mockResolvedValue({
      data: { unreadCount: 3, version: "2026-06-30T12:00:00.000Z" },
      etag: '"version-1"',
      notModified: false,
    });
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

    expect(getNotificationSummaryMock).toHaveBeenCalledWith("token", undefined, expect.any(AbortSignal));
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/admin/notifications");
    expect(container.textContent).toContain("3");
  });

  it("caps the visible unread badge", async () => {
    getNotificationSummaryMock.mockResolvedValue({
      data: { unreadCount: 12, version: "2026-06-30T12:00:00.000Z" },
      etag: '"version-1"',
      notModified: false,
    });

    await act(async () => {
      root.render(<NotificationCenterButton />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("9+");
  });

  it("refreshes unread count while the user stays on the page", async () => {
    vi.useFakeTimers();
    getNotificationSummaryMock
      .mockResolvedValueOnce({
        data: { unreadCount: 0, version: "2026-06-30T12:00:00.000Z" },
        etag: '"version-1"',
        notModified: false,
      })
      .mockResolvedValueOnce({
        data: { unreadCount: 2, version: "2026-06-30T12:01:00.000Z" },
        etag: '"version-2"',
        notModified: false,
      });

    await act(async () => {
      root.render(<NotificationCenterButton />);
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("2");

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(getNotificationSummaryMock).toHaveBeenCalledTimes(2);
    expect(getNotificationSummaryMock).toHaveBeenLastCalledWith(
      "token",
      '"version-1"',
      expect.any(AbortSignal),
    );
    expect(container.textContent).toContain("2");
  });
});
