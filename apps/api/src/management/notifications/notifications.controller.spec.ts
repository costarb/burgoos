import type { Response } from "express";
import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../platform/auth/auth.types";
import { NotificationsController } from "./notifications.controller";

describe("NotificationsController", () => {
  it("scopes list queries to the authenticated tenant and user", () => {
    const list = vi.fn().mockReturnValue({ unreadCount: 0, items: [] });
    const controller = new NotificationsController({ list } as never);
    controller.list(user(), { limit: 20, since: "2026-06-30T12:00:00.000Z" });
    expect(list).toHaveBeenCalledWith("tenant-1", "user-1", {
      limit: 20,
      since: "2026-06-30T12:00:00.000Z",
    });
  });

  it("sets ETag and returns 304 when the summary version is unchanged", async () => {
    const summary = vi.fn().mockResolvedValue({
      unreadCount: 3,
      version: "2026-06-30T12:00:00.000Z",
      etag: '"version-a"',
    });
    const response = responseMock();
    const controller = new NotificationsController({ summary } as never);

    await expect(controller.summary(user(), '"version-a"', response as never)).resolves.toBeUndefined();

    expect(summary).toHaveBeenCalledWith("tenant-1", "user-1");
    expect(response.setHeader).toHaveBeenCalledWith("ETag", '"version-a"');
    expect(response.status).toHaveBeenCalledWith(304);
  });

  it("returns the minimal summary when the ETag changed", async () => {
    const summary = vi.fn().mockResolvedValue({
      unreadCount: 3,
      version: "2026-06-30T12:00:00.000Z",
      etag: '"version-b"',
    });
    const response = responseMock();
    const controller = new NotificationsController({ summary } as never);

    await expect(controller.summary(user(), '"version-a"', response as never)).resolves.toEqual({
      unreadCount: 3,
      version: "2026-06-30T12:00:00.000Z",
    });
    expect(response.status).not.toHaveBeenCalled();
  });
});

function responseMock(): Pick<Response, "setHeader" | "status"> {
  return {
    setHeader: vi.fn() as never,
    status: vi.fn().mockReturnThis() as never,
  };
}

function user(): AuthUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    role: UserRole.ADMIN,
    email: "admin@example.com",
    name: "Admin",
  };
}
