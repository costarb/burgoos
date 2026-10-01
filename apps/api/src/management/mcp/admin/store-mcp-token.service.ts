import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult, Prisma } from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../../access/access-audit.service";
import { CreateMcpTokenDto } from "./dto/store-mcp.dto";
import { buildMcpSnippets, McpConfigurationSnippets } from "./mcp-snippets";
import {
  expiresAtFrom,
  generateMcpToken,
  MCP_MAX_ACTIVE_TOKENS,
  mcpTokenStatus,
  McpTokenStatus,
} from "./mcp-token.util";

export interface McpTokenView {
  id: string;
  name: string;
  tokenPrefix: string;
  status: McpTokenStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  revokedAt: string | null;
}

export interface CreatedMcpTokenView extends McpTokenView {
  token: string;
  snippets: McpConfigurationSnippets;
}

const tokenInclude = {
  createdByUser: { select: { name: true } },
} satisfies Prisma.StoreMcpTokenInclude;

type TokenWithCreator = Prisma.StoreMcpTokenGetPayload<{ include: typeof tokenInclude }>;

@Injectable()
export class StoreMcpTokenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  async list(tenantId: string, now = new Date()): Promise<McpTokenView[]> {
    const tokens = await this.prisma.storeMcpToken.findMany({
      where: { tenantId },
      include: tokenInclude,
      orderBy: { createdAt: "desc" },
    });
    return tokens.map((token) => toView(token, now));
  }

  async create(
    user: AuthUser,
    dto: CreateMcpTokenDto,
    serverUrl: string,
    now = new Date()
  ): Promise<CreatedMcpTokenView> {
    const generated = generateMcpToken();

    const { token, storeSlug } = await this.prisma.$transaction(async (tx) => {
      const [configuration, tenant] = await Promise.all([
        tx.storeMcpConfiguration.findUnique({
          where: { tenantId: user.tenantId },
          select: { enabled: true },
        }),
        tx.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { slug: true } }),
      ]);

      if (!configuration?.enabled) {
        throw new ConflictException({
          code: "MCP_DISABLED",
          message: "Habilite o MCP da loja antes de gerar um token.",
        });
      }

      const activeCount = await tx.storeMcpToken.count({
        where: {
          tenantId: user.tenantId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });
      if (activeCount >= MCP_MAX_ACTIVE_TOKENS) {
        throw new ConflictException({
          code: "TOKEN_LIMIT_REACHED",
          message: `A loja ja possui ${MCP_MAX_ACTIVE_TOKENS} tokens ativos. Revogue tokens sem uso para gerar outro.`,
        });
      }

      const created = await tx.storeMcpToken.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name.trim(),
          tokenHash: generated.tokenHash,
          tokenPrefix: generated.tokenPrefix,
          expiresAt: expiresAtFrom(dto.expiresInDays, now),
          createdByUserId: user.id,
        },
        include: tokenInclude,
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          storeId: user.tenantId,
          eventType: AccessAuditEventType.MCP_TOKEN_CREATED,
          result: AccessAuditResult.SUCCESS,
          metadata: {
            mcpCredentialId: created.id,
            name: created.name,
            visiblePrefix: created.tokenPrefix,
            expiresAt: created.expiresAt?.toISOString() ?? null,
          },
        },
        tx
      );

      return { token: created, storeSlug: tenant.slug };
    });

    return {
      ...toView(token, now),
      token: generated.token,
      snippets: buildMcpSnippets({ serverUrl, token: generated.token, storeSlug }),
    };
  }

  async revoke(user: AuthUser, tokenId: string, now = new Date()): Promise<McpTokenView> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.storeMcpToken.findFirst({
        where: { id: tokenId, tenantId: user.tenantId },
        include: tokenInclude,
      });
      if (!existing) throw new NotFoundException("Token nao encontrado");
      if (existing.revokedAt) return toView(existing, now);

      const revoked = await tx.storeMcpToken.update({
        where: { id: existing.id },
        data: { revokedAt: now, revokedByUserId: user.id },
        include: tokenInclude,
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          storeId: user.tenantId,
          eventType: AccessAuditEventType.MCP_TOKEN_REVOKED,
          result: AccessAuditResult.SUCCESS,
          metadata: {
            mcpCredentialId: revoked.id,
            name: revoked.name,
            visiblePrefix: revoked.tokenPrefix,
          },
        },
        tx
      );

      return toView(revoked, now);
    });
  }
}

function toView(token: TokenWithCreator, now: Date): McpTokenView {
  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    status: mcpTokenStatus(token, now),
    expiresAt: token.expiresAt?.toISOString() ?? null,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
    createdBy: token.createdByUser?.name ?? null,
    revokedAt: token.revokedAt?.toISOString() ?? null,
  };
}
