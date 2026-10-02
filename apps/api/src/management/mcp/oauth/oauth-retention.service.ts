import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { McpOAuthClientKind, McpOAuthRequestStatus } from "@prisma/client";
import { RuntimeRoleService } from "../../../config/runtime-role.service";
import { PrismaService } from "../../../platform/database/prisma.service";

const DAY_MS = 86_400_000;
const TOKEN_GRACE_DAYS = 7;
const UNUSED_DCR_CLIENT_DAYS = 30;

/** Daily cleanup of finished authorization requests, old tokens and unused DCR clients. */
@Injectable()
export class OAuthRetentionService {
  private readonly logger = new Logger(OAuthRetentionService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RuntimeRoleService) private readonly runtimeRole: RuntimeRoleService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledPurge() {
    if (!this.runtimeRole.consumesBackgroundJobs) return null;
    return this.purge();
  }

  async purge(now = new Date()) {
    const requests = await this.prisma.mcpOAuthAuthorizationRequest.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(now.getTime() - DAY_MS) }, status: McpOAuthRequestStatus.PENDING },
          {
            status: { in: [McpOAuthRequestStatus.CONSUMED, McpOAuthRequestStatus.DENIED, McpOAuthRequestStatus.EXPIRED] },
            expiresAt: { lt: new Date(now.getTime() - DAY_MS) },
          },
          { status: McpOAuthRequestStatus.APPROVED, codeExpiresAt: { lt: new Date(now.getTime() - DAY_MS) } },
        ],
      },
    });
    const tokens = await this.prisma.mcpOAuthToken.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - TOKEN_GRACE_DAYS * DAY_MS) } },
    });
    const clients = await this.prisma.mcpOAuthClient.deleteMany({
      where: {
        kind: McpOAuthClientKind.DCR,
        createdAt: { lt: new Date(now.getTime() - UNUSED_DCR_CLIENT_DAYS * DAY_MS) },
        connections: { none: {} },
      },
    });

    const result = { requests: requests.count, tokens: tokens.count, clients: clients.count };
    if (result.requests + result.tokens + result.clients > 0) {
      this.logger.log(`mcp.oauth.retention ${JSON.stringify(result)}`);
    }
    return result;
  }
}
