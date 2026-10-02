import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { McpOAuthUrls, resolveMcpOAuthUrls } from "./oauth-urls";

@Injectable()
export class OAuthUrlsProvider {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  for(request: Request): McpOAuthUrls {
    return resolveMcpOAuthUrls(
      {
        mcpPublicUrl: this.config.get<string>("MCP_PUBLIC_URL"),
        webPublicUrl: this.config.get<string>("WEB_PUBLIC_URL"),
        webOrigin: this.config.get<string>("WEB_ORIGIN"),
      },
      request
    );
  }
}
