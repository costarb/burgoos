import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../platform/database/prisma.service";

@Injectable()
export class SalesImportRetentionService {
  constructor(private readonly prisma: PrismaService) {}
  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 180 * 86400000);
    const result = await this.prisma.salesImportRun.deleteMany({ where: { createdAt: { lt: cutoff }, status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"] } } });
    return result.count;
  }
}
