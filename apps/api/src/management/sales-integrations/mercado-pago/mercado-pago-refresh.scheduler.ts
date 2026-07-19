import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../platform/database/prisma.service";
import { MercadoPagoRefreshService } from "./mercado-pago-refresh.service";

@Injectable()
export class MercadoPagoRefreshScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshService: MercadoPagoRefreshService
  ) {}
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async renewExpiring(): Promise<void> {
    const threshold = new Date(Date.now() + 15 * 86_400_000);
    const connections = await this.prisma.salesIntegration.findMany({
      where: {
        provider: "MERCADO_PAGO",
        credentialMode: "OAUTH",
        status: { in: ["ACTIVE", "TOKEN_EXPIRING"] },
        tokenExpiresAt: { lte: threshold },
      },
      select: { id: true, tenantId: true },
    });
    await Promise.allSettled(
      connections.map((connection) =>
        this.refreshService.refresh(connection.tenantId, connection.id)
      )
    );
  }
}
