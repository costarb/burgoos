import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../platform/database/prisma.service";

@Injectable()
export class SalesIntegrationOperationLockService {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(input: {
    tenantId: string;
    integrationId: string;
    owner: string;
    leaseMs?: number;
  }): Promise<boolean> {
    const now = new Date();
    const operationLockUntil = new Date(now.getTime() + (input.leaseMs ?? 60_000));
    const result = await this.prisma.salesIntegration.updateMany({
      where: {
        id: input.integrationId,
        tenantId: input.tenantId,
        OR: [
          { operationLockUntil: null },
          { operationLockUntil: { lte: now } },
          { operationLockOwner: input.owner },
        ],
      },
      data: { operationLockOwner: input.owner, operationLockUntil },
    });
    return result.count === 1;
  }

  async release(input: { tenantId: string; integrationId: string; owner: string }): Promise<void> {
    await this.prisma.salesIntegration.updateMany({
      where: {
        id: input.integrationId,
        tenantId: input.tenantId,
        operationLockOwner: input.owner,
      },
      data: { operationLockOwner: null, operationLockUntil: null },
    });
  }
}
