import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../../access/access-audit.service";
import { redirectHost } from "./redirect-uri";

export type ConnectionRevokeReason = "MANUAL" | "REFRESH_REUSE" | "CODE_REUSE" | "CLIENT_REVOKED";

export interface McpConnectionView {
  id: string;
  clientName: string;
  clientKind: "CIMD" | "DCR";
  redirectHost: string;
  userName: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}

const connectionInclude = {
  client: { select: { name: true, kind: true, redirectUris: true } },
  user: { select: { name: true } },
} satisfies Prisma.McpOAuthConnectionInclude;

type ConnectionWithDetails = Prisma.McpOAuthConnectionGetPayload<{ include: typeof connectionInclude }>;

@Injectable()
export class OAuthConnectionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  async list(tenantId: string): Promise<McpConnectionView[]> {
    const rows = await this.prisma.mcpOAuthConnection.findMany({
      where: { tenantId },
      include: connectionInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows
      .map(toView)
      .sort((left, right) => Number(left.status === "REVOKED") - Number(right.status === "REVOKED"));
  }

  /** Admin revocation scoped to the active store; idempotent. */
  async revokeForStore(tenantId: string, connectionId: string, actorUserId: string): Promise<McpConnectionView> {
    const existing = await this.prisma.mcpOAuthConnection.findFirst({
      where: { id: connectionId, tenantId },
      include: connectionInclude,
    });
    if (!existing) throw new NotFoundException("Conexao nao encontrada");
    if (existing.revokedAt) return toView(existing);
    await this.revoke(existing.id, "MANUAL", actorUserId);
    const updated = await this.prisma.mcpOAuthConnection.findFirst({
      where: { id: connectionId, tenantId },
      include: connectionInclude,
    });
    return toView(updated ?? existing);
  }

  /** Revokes a connection and all of its tokens, recording the reason in the access audit. */
  async revoke(connectionId: string, reason: ConnectionRevokeReason, actorUserId?: string | null): Promise<void> {
    const now = new Date();
    const connection = await this.prisma.mcpOAuthConnection.findUnique({
      where: { id: connectionId },
      include: { client: { select: { name: true } } },
    });
    if (!connection || connection.revokedAt) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.mcpOAuthConnection.update({
        where: { id: connectionId },
        data: { revokedAt: now, revokedReason: reason, revokedByUserId: actorUserId ?? null },
      });
      await tx.mcpOAuthToken.updateMany({
        where: { connectionId, rotatedAt: null },
        data: { rotatedAt: now, expiresAt: now },
      });
      await this.audit.record(
        {
          actorUserId: actorUserId ?? null,
          targetUserId: connection.userId,
          storeId: connection.tenantId,
          eventType: AccessAuditEventType.MCP_CONNECTION_REVOKED,
          result: AccessAuditResult.SUCCESS,
          reason,
          metadata: { mcpConnectionId: connectionId, client: connection.client.name },
        },
        tx
      );
    });
  }
}

function toView(connection: ConnectionWithDetails): McpConnectionView {
  return {
    id: connection.id,
    clientName: connection.client.name,
    clientKind: connection.client.kind,
    redirectHost: connection.client.redirectUris[0] ? redirectHost(connection.client.redirectUris[0]) : "-",
    userName: connection.user.name,
    status: connection.revokedAt ? "REVOKED" : "ACTIVE",
    createdAt: connection.createdAt.toISOString(),
    lastUsedAt: connection.lastUsedAt?.toISOString() ?? null,
    revokedAt: connection.revokedAt?.toISOString() ?? null,
    revokedReason: connection.revokedReason,
  };
}
