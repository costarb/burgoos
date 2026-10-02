import { Inject, Injectable, Logger } from "@nestjs/common";
import { McpOAuthClient, McpOAuthClientKind } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../../../platform/database/prisma.service";
import { CimdFetcher, CimdFetchError } from "./cimd-fetcher";
import { OAuthError, UntrustedAuthorizationRequest } from "./oauth-errors";
import { DCR_CLIENT_PREFIX } from "./oauth-tokens.util";
import { isAllowedRedirectUri } from "./redirect-uri";

const CIMD_CACHE_MS = 24 * 60 * 60 * 1000;

export interface RegisterClientInput {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
}

/** Resolves the OAuth client behind a client_id: a CIMD URL (cached) or a DCR registration. */
@Injectable()
export class OAuthClientService {
  private readonly logger = new Logger(OAuthClientService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CimdFetcher) private readonly cimd: CimdFetcher
  ) {}

  async resolve(clientId: string | undefined, now = new Date()): Promise<McpOAuthClient> {
    if (!clientId) throw new UntrustedAuthorizationRequest("INVALID_CLIENT", "Aplicativo nao identificado.");

    if (clientId.startsWith("https://")) return this.resolveCimd(clientId, now);

    const registered = await this.prisma.mcpOAuthClient.findUnique({ where: { clientId } });
    if (!registered || registered.kind !== McpOAuthClientKind.DCR) {
      throw new UntrustedAuthorizationRequest("INVALID_CLIENT", "Aplicativo nao reconhecido.");
    }
    return registered;
  }

  /** Token/revoke endpoints: the client must already be known (no metadata fetch). */
  async findKnown(clientId: string | undefined): Promise<McpOAuthClient | null> {
    if (!clientId) return null;
    return this.prisma.mcpOAuthClient.findUnique({ where: { clientId } });
  }

  async register(input: RegisterClientInput) {
    const redirectUris = Array.isArray(input.redirect_uris)
      ? input.redirect_uris.filter((item): item is string => typeof item === "string")
      : [];
    if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(isAllowedRedirectUri)) {
      throw new OAuthError(
        "invalid_redirect_uri",
        "Informe de 1 a 10 redirect_uris https ou de loopback (http://localhost, http://127.0.0.1)."
      );
    }
    const method = input.token_endpoint_auth_method ?? "none";
    if (method !== "none") {
      throw new OAuthError("invalid_client_metadata", "Somente clientes publicos (token_endpoint_auth_method=none).");
    }
    const grantTypes = Array.isArray(input.grant_types) ? input.grant_types : ["authorization_code", "refresh_token"];
    if (!grantTypes.every((grant) => grant === "authorization_code" || grant === "refresh_token")) {
      throw new OAuthError("invalid_client_metadata", "grant_types aceitos: authorization_code e refresh_token.");
    }
    const name =
      typeof input.client_name === "string" && input.client_name.trim()
        ? input.client_name.trim().slice(0, 120)
        : "Aplicativo MCP";

    const client = await this.prisma.mcpOAuthClient.create({
      data: {
        clientId: `${DCR_CLIENT_PREFIX}${randomBytes(18).toString("base64url")}`,
        kind: McpOAuthClientKind.DCR,
        name,
        redirectUris,
      },
    });

    return {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    };
  }

  private async resolveCimd(clientId: string, now: Date): Promise<McpOAuthClient> {
    const cached = await this.prisma.mcpOAuthClient.findUnique({ where: { clientId } });
    if (
      cached?.kind === McpOAuthClientKind.CIMD &&
      cached.metadataFetchedAt &&
      now.getTime() - cached.metadataFetchedAt.getTime() < CIMD_CACHE_MS
    ) {
      return cached;
    }

    let document;
    try {
      document = await this.cimd.fetch(clientId);
    } catch (error) {
      const message = error instanceof CimdFetchError ? error.message : "Aplicativo nao identificado.";
      this.logger.warn(`mcp.oauth.cimd_rejected clientId=${clientId} reason=${message}`);
      throw new UntrustedAuthorizationRequest("INVALID_CLIENT", message);
    }

    const data = {
      kind: McpOAuthClientKind.CIMD,
      name: document.clientName ?? new URL(clientId).host,
      redirectUris: document.redirectUris,
      metadataFetchedAt: now,
    };
    return this.prisma.mcpOAuthClient.upsert({
      where: { clientId },
      create: { clientId, ...data },
      update: data,
    });
  }
}
