import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../platform/database/prisma.service";

@Injectable()
export class SalesImportRetentionService {
  constructor(private readonly prisma: PrismaService) {}
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpired(now = new Date()): Promise<number> {
    const historicalCutoff = new Date(now.getTime() - 180 * 86400000);
    const oauthCutoff = new Date(now.getTime() - 24 * 60 * 60_000);
    const notificationCutoff = new Date(now.getTime() - 90 * 86400000);
    const runs = await this.prisma.salesImportRun.deleteMany({
      where: {
        createdAt: { lt: historicalCutoff },
        status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"] },
      },
    });
    const attempts = this.prisma.oAuthAuthorizationAttempt?.deleteMany
      ? await this.prisma.oAuthAuthorizationAttempt.deleteMany({
          where: {
            expiresAt: { lt: oauthCutoff },
            status: { in: ["COMPLETED", "EXPIRED", "FAILED"] },
          },
        })
      : { count: 0 };
    const notifications = this.prisma.providerNotification?.deleteMany
      ? await this.prisma.providerNotification.deleteMany({
          where: {
            receivedAt: { lt: notificationCutoff },
            status: { in: ["PROCESSED", "IGNORED"] },
          },
        })
      : { count: 0 };
    return runs.count + attempts.count + notifications.count;
  }
}
