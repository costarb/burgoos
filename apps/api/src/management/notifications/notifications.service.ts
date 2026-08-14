import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  OperationalNotificationSeverity,
  OperationalNotificationStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { createHash } from "node:crypto";

interface CreateNotificationInput {
  tenantId: string;
  recipientUserId: string;
  type: string;
  severity?: OperationalNotificationSeverity;
  title: string;
  message: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  exportJobId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    recipientUserId: string,
    query: { status?: OperationalNotificationStatus; limit?: number; cursor?: string; since?: string } = {}
  ) {
    const where: Prisma.OperationalNotificationWhereInput = {
      tenantId,
      recipientUserId,
      archivedAt: null,
      status: query.status,
      ...(query.since
        ? {
            OR: [
              { createdAt: { gt: new Date(query.since) } },
              { readAt: { gt: new Date(query.since) } },
            ],
          }
        : {}),
    };
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);

    const [items, summary] = await Promise.all([
      this.prisma.operationalNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.summary(tenantId, recipientUserId),
    ]);
    const pageItems = items.slice(0, limit);

    return {
      unreadCount: summary.unreadCount,
      items: pageItems.map((notification) => this.toResponse(notification)),
      nextCursor: items.length > limit ? pageItems.at(-1)?.id ?? null : null,
      version: summary.version,
    };
  }

  async summary(tenantId: string, recipientUserId: string) {
    const scope = { tenantId, recipientUserId };
    const [unreadCount, latestCreated, latestRead] = await Promise.all([
      this.prisma.operationalNotification.count({
        where: { ...scope, archivedAt: null, status: OperationalNotificationStatus.UNREAD },
      }),
      this.prisma.operationalNotification.findFirst({
        where: scope,
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.operationalNotification.findFirst({
        where: { ...scope, readAt: { not: null } },
        select: { readAt: true },
        orderBy: { readAt: "desc" },
      }),
    ]);
    const version = latestVersion(latestCreated?.createdAt, latestRead?.readAt);
    return { unreadCount, version, etag: notificationEtag(unreadCount, version) };
  }

  async markRead(tenantId: string, recipientUserId: string, notificationId: string) {
    const notification = await this.prisma.operationalNotification.findFirst({
      where: { id: notificationId, tenantId, recipientUserId, archivedAt: null },
    });

    if (!notification) {
      throw new NotFoundException("Notificacao nao encontrada");
    }

    if (notification.status === OperationalNotificationStatus.READ) {
      return this.toResponse(notification);
    }

    const updated = await this.prisma.operationalNotification.update({
      where: { id: notificationId },
      data: { status: OperationalNotificationStatus.READ, readAt: new Date() },
    });

    return this.toResponse(updated);
  }

  async create(
    input: CreateNotificationInput,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const notification = await tx.operationalNotification.create({
      data: {
        tenantId: input.tenantId,
        recipientUserId: input.recipientUserId,
        type: input.type,
        severity: input.severity ?? OperationalNotificationSeverity.INFO,
        title: input.title,
        message: input.message,
        actionLabel: input.actionLabel ?? null,
        actionUrl: normalizeActionUrl(input.actionUrl, input.exportJobId),
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        exportJobId: input.exportJobId ?? null,
      },
    });

    return this.toResponse(notification);
  }

  private toResponse(notification: {
    id: string;
    type: string;
    status: OperationalNotificationStatus;
    severity: OperationalNotificationSeverity;
    title: string;
    message: string;
    actionLabel: string | null;
    actionUrl: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    createdAt: Date;
    readAt: Date | null;
  }) {
    return {
      id: notification.id,
      type: notification.type,
      status: notification.status,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      actionLabel: notification.actionLabel,
      actionUrl: notification.actionUrl,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
    };
  }
}

function latestVersion(...dates: Array<Date | null | undefined>): string {
  const timestamp = Math.max(0, ...dates.map((date) => date?.getTime() ?? 0));
  return new Date(timestamp).toISOString();
}

function notificationEtag(unreadCount: number, version: string): string {
  const digest = createHash("sha256").update(`${unreadCount}:${version}`).digest("base64url");
  return `"${digest}"`;
}

function normalizeActionUrl(value?: string | null, exportJobId?: string | null): string | null {
  if (!value?.startsWith("/api/admin/exports/")) {
    return null;
  }

  if (!exportJobId) {
    return null;
  }

  const expected = `/api/admin/exports/${exportJobId}/download`;
  return value === expected ? value : null;
}
