import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RuntimeRoleService } from "../../../config/runtime-role.service";
import { PrismaService } from "../../../platform/database/prisma.service";

/** Deletes MCP usage log rows older than the retention window (90 days by default). */
@Injectable()
export class McpCallRetentionService {
  private readonly logger = new Logger(McpCallRetentionService.name);
  private readonly retentionDays: number;
  private readonly batchSize: number;
  private readonly deadlineMs: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RuntimeRoleService) private readonly runtimeRole: RuntimeRoleService,
    @Inject(ConfigService) config: ConfigService
  ) {
    this.retentionDays = config.get<number>("MCP_TOOL_CALL_RETENTION_DAYS") ?? 90;
    this.batchSize = config.get<number>("RETENTION_BATCH_SIZE") ?? 250;
    this.deadlineMs = config.get<number>("RETENTION_DEADLINE_MS") ?? 5_000;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledPurge(): Promise<number> {
    if (!this.runtimeRole.consumesBackgroundJobs) return 0;
    return this.purge();
  }

  async purge(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.retentionDays * 86_400_000);
    const deadline = Date.now() + this.deadlineMs;
    let deleted = 0;

    while (Date.now() < deadline) {
      const rows = await this.prisma.mcpToolCall.findMany({
        where: { occurredAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { occurredAt: "asc" },
        take: this.batchSize,
      });
      if (rows.length === 0) break;
      const result = await this.prisma.mcpToolCall.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
      deleted += result.count;
      if (rows.length < this.batchSize) break;
    }

    if (deleted > 0) this.logger.log(`mcp.call_retention deleted=${deleted} cutoff=${cutoff.toISOString()}`);
    return deleted;
  }
}
