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
      take: 100,
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
    expect(response.items[0]).toEqual(
      expect.objectContaining({
        id: "notification-1",
        status: "UNREAD",
        createdAt: "2026-06-30T12:00:00.000Z",
      })
    );
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
