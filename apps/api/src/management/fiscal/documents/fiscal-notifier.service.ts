import { Inject, Injectable } from "@nestjs/common";
import { AccessProfileStatus, OperationalNotificationSeverity, UserRole } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

export interface FiscalNotification {
  type: string;
  severity: OperationalNotificationSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/** Notifies every active user of the store that holds the permission (owners and admins always). */
@Injectable()
export class FiscalNotifierService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService
  ) {}

  async notify(tenantId: string, permission: string, notification: FiscalNotification): Promise<number> {
    const recipients = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { tenantId, role: { in: [UserRole.OWNER, UserRole.ADMIN] } },
          {
            storeAssignments: {
              some: {
                tenantId,
                status: AccessProfileStatus.ACTIVE,
                profile: { permissions: { some: { permission: { key: permission } } } },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    for (const recipient of recipients) {
      await this.notifications.create({ tenantId, recipientUserId: recipient.id, ...notification });
    }
    return recipients.length;
  }
}
