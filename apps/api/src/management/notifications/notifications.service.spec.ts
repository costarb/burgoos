import { NotFoundException } from "@nestjs/common";
import { OperationalNotificationSeverity, OperationalNotificationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  it("lists only notifications scoped to tenant and recipient with unread count", async () => {
    const prisma = createPrismaMock();
    const service = new NotificationsService(prisma as never);

    const response = await service.list("tenant-1", "user-1", { limit: 500 });

    expect(prisma.operationalNotification.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        recipientUserId: "user-1",
        archivedAt: null,
        status: undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 51,
    });
    expect(prisma.operationalNotification.count).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        recipientUserId: "user-1",
        archivedAt: null,
        status: OperationalNotificationStatus.UNREAD,
      },
    });
    expect(response.unreadCount).toBe(1);
    expect(response.version).toBe("2026-06-30T12:00:00.000Z");
    expect(response.items[0]).toEqual(
      expect.objectContaining({
        id: "notification-1",
        status: "UNREAD",
        createdAt: "2026-06-30T12:00:00.000Z",
      })
    );
  });

  it("returns a bounded tenant/user delta and an opaque next cursor", async () => {
    const items = Array.from({ length: 3 }, (_, index) => notification({
      id: `notification-${index + 1}`,
      createdAt: new Date(`2026-06-30T12:00:0${index}.000Z`),
    }));
    const prisma = createPrismaMock();
    prisma.operationalNotification.findMany.mockResolvedValue(items);
    const service = new NotificationsService(prisma as never);

    const response = await service.list("tenant-1", "user-1", {
      limit: 2,
      cursor: "11111111-1111-4111-8111-111111111111",
      since: "2026-06-30T11:00:00.000Z",
    });

    expect(prisma.operationalNotification.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: "tenant-1",
        recipientUserId: "user-1",
        OR: [
          { createdAt: { gt: new Date("2026-06-30T11:00:00.000Z") } },
          { readAt: { gt: new Date("2026-06-30T11:00:00.000Z") } },
        ],
      }),
      orderBy: { createdAt: "desc" },
      take: 3,
      cursor: { id: "11111111-1111-4111-8111-111111111111" },
      skip: 1,
    });
    expect(response.items).toHaveLength(2);
    expect(response.nextCursor).toBe("notification-2");
  });

  it("builds the summary version and ETag only from the scoped recipient", async () => {
    const prisma = createPrismaMock();
    prisma.operationalNotification.findFirst
      .mockResolvedValueOnce({ createdAt: new Date("2026-06-30T12:00:00.000Z") })
      .mockResolvedValueOnce({ readAt: new Date("2026-06-30T12:05:00.000Z") });
    const service = new NotificationsService(prisma as never);

    const summary = await service.summary("tenant-1", "user-1");

    expect(prisma.operationalNotification.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: "tenant-1", recipientUserId: "user-1" }),
    });
    expect(prisma.operationalNotification.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { tenantId: "tenant-1", recipientUserId: "user-1" },
    }));
    expect(summary).toEqual({
      unreadCount: 1,
      version: "2026-06-30T12:05:00.000Z",
      etag: expect.stringMatching(/^"[A-Za-z0-9_-]+"$/),
    });
  });

  it("marks unread notifications as read using tenant and recipient scope", async () => {
    const prisma = createPrismaMock();
    const service = new NotificationsService(prisma as never);

    const response = await service.markRead("tenant-1", "user-1", "notification-1");

    expect(prisma.operationalNotification.findFirst).toHaveBeenCalledWith({
      where: {
        id: "notification-1",
        tenantId: "tenant-1",
        recipientUserId: "user-1",
        archivedAt: null,
      },
    });
    expect(prisma.operationalNotification.update).toHaveBeenCalledWith({
      where: { id: "notification-1" },
      data: {
        status: OperationalNotificationStatus.READ,
        readAt: expect.any(Date),
      },
    });
    expect(response.status).toBe("READ");
  });

  it("rejects read changes outside the current tenant and user scope", async () => {
    const prisma = createPrismaMock({ findFirst: null });
    const service = new NotificationsService(prisma as never);

    await expect(service.markRead("tenant-1", "user-1", "notification-2")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("keeps only same export download action URLs that match the related export job", async () => {
    const prisma = createPrismaMock();
    const service = new NotificationsService(prisma as never);

    await service.create({
      tenantId: "tenant-1",
      recipientUserId: "user-1",
      type: "PAYABLE_EXPORT_COMPLETED",
      title: "Exportacao concluida",
      message: "Arquivo pronto.",
      actionUrl: "https://evil.example/download",
      exportJobId: "export-1",
    });

    expect(prisma.operationalNotification.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        actionUrl: null,
        exportJobId: "export-1",
      }),
    });

    await service.create({
      tenantId: "tenant-1",
      recipientUserId: "user-1",
      type: "PAYABLE_EXPORT_COMPLETED",
      title: "Exportacao concluida",
      message: "Arquivo pronto.",
      actionUrl: "/api/admin/exports/export-1/download",
      exportJobId: "export-1",
    });

    expect(prisma.operationalNotification.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        actionUrl: "/api/admin/exports/export-1/download",
        exportJobId: "export-1",
      }),
    });
  });
});

function createPrismaMock(overrides: { findFirst?: unknown } = {}) {
  return {
    operationalNotification: {
      findMany: vi.fn().mockResolvedValue([notification()]),
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi
        .fn()
        .mockResolvedValue(
          Object.prototype.hasOwnProperty.call(overrides, "findFirst")
            ? overrides.findFirst
            : notification()
        ),
      update: vi
        .fn()
        .mockResolvedValue(notification({ status: OperationalNotificationStatus.READ })),
      create: vi.fn().mockResolvedValue(notification()),
    },
  };
}

function notification(overrides: Partial<ReturnType<typeof baseNotification>> = {}) {
  return { ...baseNotification(), ...overrides };
}

function baseNotification() {
  return {
    id: "notification-1",
    tenantId: "tenant-1",
    recipientUserId: "user-1",
    exportJobId: "export-1",
    type: "PAYABLE_EXPORT_COMPLETED",
    status: OperationalNotificationStatus.UNREAD as OperationalNotificationStatus,
    severity: OperationalNotificationSeverity.SUCCESS as OperationalNotificationSeverity,
    title: "Exportacao concluida",
    message: "Arquivo pronto.",
    actionLabel: "Baixar arquivo",
    actionUrl: "/api/admin/exports/export-1/download",
    relatedEntityType: "export_job",
    relatedEntityId: "export-1",
    createdAt: new Date("2026-06-30T12:00:00.000Z"),
    readAt: null,
    archivedAt: null,
  };
}
