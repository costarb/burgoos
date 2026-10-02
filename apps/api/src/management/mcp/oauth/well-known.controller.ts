import { Controller, Get, Inject, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { MCP_OAUTH_SCOPE } from "./oauth-urls";
import { OAuthUrlsProvider } from "./oauth-urls.provider";

/**
 * Discovery documents served at the origin root (excluded from the /api prefix):
 * OAuth Protected Resource Metadata (RFC 9728) and Authorization Server Metadata (RFC 8414).
 */
@ApiExcludeController()
@Controller(".well-known")
export class WellKnownController {
  constructor(@Inject(OAuthUrlsProvider) private readonly urls: OAuthUrlsProvider) {}

  @Get(["oauth-protected-resource", "oauth-protected-resource/*"])
  protectedResource(@Req() request: Request, @Res() response: Response): void {
    const urls = this.urls.for(request);
    send(response, {
      resource: urls.resource,
      authorization_servers: [urls.issuer],
      scopes_supported: [MCP_OAUTH_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "RRFive OS",
    });
  }

  @Get(["oauth-authorization-server", "oauth-authorization-server/*"])
  authorizationServer(@Req() request: Request, @Res() response: Response): void {
    const urls = this.urls.for(request);
    send(response, {
      issuer: urls.issuer,
      authorization_endpoint: urls.authorizationEndpoint,
      token_endpoint: urls.tokenEndpoint,
      registration_endpoint: urls.registrationEndpoint,
      revocation_endpoint: urls.revocationEndpoint,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [MCP_OAUTH_SCOPE],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    });
  }
}

function send(response: Response, body: Record<string, unknown>): void {
  response
    .status(200)
    .setHeader("Cache-Control", "public, max-age=300")
    .setHeader("Access-Control-Allow-Origin", "*")
    .json(body);
}
