import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { FixedWindowRateLimitGuard } from "../../../common/rate-limit/fixed-window-rate-limit.guard";
import { stringParams } from "./oauth-authorize.controller";
import { OAuthClientService, RegisterClientInput } from "./oauth-client.service";
import { OAuthError } from "./oauth-errors";
import { OAuthTokenService } from "./oauth-token.service";
import { OAuthUrlsProvider } from "./oauth-urls.provider";

class OAuthRegisterRateLimitGuard extends FixedWindowRateLimitGuard {
  protected readonly limit = 20;
  protected readonly windowMs: number = 3_600_000;
  protected readonly namespace = "mcp-oauth-register";
}

class OAuthTokenRateLimitGuard extends FixedWindowRateLimitGuard {
  protected readonly limit = 120;
  protected readonly namespace = "mcp-oauth-token";
}

@ApiExcludeController()
@Controller("oauth")
export class OAuthTokenController {
  constructor(
    @Inject(OAuthTokenService) private readonly tokens: OAuthTokenService,
    @Inject(OAuthClientService) private readonly clients: OAuthClientService,
    @Inject(OAuthUrlsProvider) private readonly urls: OAuthUrlsProvider
  ) {}

  /** RFC 6749 token endpoint (form-urlencoded), public clients only. */
  @Post("token")
  @HttpCode(200)
  @UseGuards(OAuthTokenRateLimitGuard)
  async token(@Body() body: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    noStore(response);
    if (!request.is("application/x-www-form-urlencoded")) {
      throw new OAuthError("invalid_request", "Use Content-Type application/x-www-form-urlencoded.");
    }
    const params = stringParams(body ?? {});
    if (params.client_id && !(await this.clients.findKnown(params.client_id))) {
      throw new OAuthError("invalid_client", "Aplicativo desconhecido.");
    }
    response.json(await this.tokens.exchange(params, this.urls.for(request)));
  }

  /** RFC 7009: always 200. */
  @Post("revoke")
  @HttpCode(200)
  @UseGuards(OAuthTokenRateLimitGuard)
  async revoke(@Body() body: Record<string, unknown>, @Res() response: Response) {
    noStore(response);
    await this.tokens.revoke(stringParams(body ?? {}));
    response.json({});
  }

  /** RFC 7591 dynamic client registration (kept for clients without CIMD). */
  @Post("register")
  @HttpCode(201)
  @UseGuards(OAuthRegisterRateLimitGuard)
  async register(@Body() body: RegisterClientInput, @Res() response: Response) {
    noStore(response);
    response.status(201).json(await this.clients.register(body ?? {}));
  }
}

function noStore(response: Response): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
}
