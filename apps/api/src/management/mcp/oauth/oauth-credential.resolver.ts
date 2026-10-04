import { Inject, Injectable } from "@nestjs/common";
import { AccessProfileStatus, McpOAuthTokenKind } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { normalizeAreas } from "../mcp-data-areas";
import { actionChannel, hasWriteScope, NO_ACTIONS } from "../mcp-actions";
import { McpDeniedReason, McpRequestContext } from "../server/mcp-context";
import { ACCESS_TOKEN_PREFIX, hashSecret, hasOpaqueShape } from "./oauth-tokens.util";
import { matchesResource } from "./oauth-urls";
import { isActiveUser, permissionsForStore } from "./store-eligibility";

export type OAuthCredentialResult =
  | { status: "ok"; context: McpRequestContext }
  | { status: "unknown" }
  | { status: "denied"; tenantId: string; connectionId: string; reason: McpDeniedReason };

export function isOAuthAccessToken(value: string): boolean {
  return hasOpaqueShape(value, ACCESS_TOKEN_PREFIX);
}

/** Resolves an OAuth access token to the store context of its connection. */
@Injectable()
export class OAuthCredentialResolver {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(
    accessToken: string,
    resource: string,
    now = new Date()
  ): Promise<OAuthCredentialResult> {
    const token = await this.prisma.mcpOAuthToken.findUnique({
      where: { tokenHash: hashSecret(accessToken) },
      include: {
        connection: {
          include: {
            client: { select: { name: true } },
            user: {
              select: {
                status: true,
                tenantId: true,
                isMaster: true,
                storeAssignments: {
                  where: { status: AccessProfileStatus.ACTIVE },
                  select: { tenantId: true },
                },
              },
            },
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                active: true,
                deactivatedAt: true,
                mcpConfiguration: {
                  select: { enabled: true, enabledAreas: true, actionsEnabled: true },
                },
              },
            },
          },
        },
      },
    });
    if (!token || token.kind !== McpOAuthTokenKind.ACCESS) return { status: "unknown" };

    const { connection } = token;
    const deny = (reason: McpDeniedReason): OAuthCredentialResult => ({
      status: "denied",
      tenantId: connection.tenantId,
      connectionId: connection.id,
      reason,
    });

    if (connection.revokedAt) return deny("CONNECTION_REVOKED");
    if (token.rotatedAt || token.expiresAt.getTime() <= now.getTime()) return deny("TOKEN_EXPIRED");
    if (!matchesResource(connection.resource, resource)) return deny("CONNECTION_REVOKED");
    if (!connection.tenant.active || connection.tenant.deactivatedAt) return deny("STORE_INACTIVE");
    if (!connection.tenant.mcpConfiguration?.enabled) return deny("MCP_DISABLED");
    if (!isActiveUser(connection.user.status)) return deny("USER_INACTIVE");
    const hasStoreAccess =
      connection.user.isMaster ||
      connection.user.tenantId === connection.tenantId ||
      connection.user.storeAssignments.some(
        (assignment) => assignment.tenantId === connection.tenantId
      );
    if (!hasStoreAccess) return deny("STORE_ACCESS_LOST");

    const canWrite =
      hasWriteScope(connection.scope) && connection.tenant.mcpConfiguration.actionsEnabled;
    const permissions = canWrite
      ? await permissionsForStore(this.prisma, connection.userId, connection.tenantId)
      : null;

    return {
      status: "ok",
      context: {
        tenantId: connection.tenantId,
        tokenId: null,
        connectionId: connection.id,
        userId: connection.userId,
        clientName: connection.client.name,
        enabledAreas: normalizeAreas(connection.tenant.mcpConfiguration.enabledAreas),
        actions: permissions
          ? { allowed: true, ...permissions, channel: actionChannel(connection.client.name) }
          : NO_ACTIONS,
        storeName: connection.tenant.name,
        storeSlug: connection.tenant.slug,
      },
    };
  }
}
