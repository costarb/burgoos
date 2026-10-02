import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { ApproveAuthorizationDto } from "./dto/oauth.dto";
import { OAuthAuthorizationService, AuthorizeQuery } from "./oauth-authorization.service";
import {
  authorizationErrorPage,
  RedirectableAuthorizationError,
  UntrustedAuthorizationRequest,
} from "./oauth-errors";
import { OAuthUrlsProvider } from "./oauth-urls.provider";
import { buildRedirect } from "./redirect-uri";

@ApiExcludeController()
@Controller("oauth")
export class OAuthAuthorizeController {
  constructor(
    @Inject(OAuthAuthorizationService) private readonly authorization: OAuthAuthorizationService,
    @Inject(OAuthUrlsProvider) private readonly urls: OAuthUrlsProvider
  ) {}

  /** Starts the browser flow: validates the request and hands the user to the web consent page. */
  @Get("authorize")
  async authorize(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const params = stringParams(query) as AuthorizeQuery;
    const urls = this.urls.for(request);
    try {
      response.redirect(302, await this.authorization.start(params, urls));
    } catch (error) {
      if (error instanceof UntrustedAuthorizationRequest) {
        response.status(400).type("html").send(authorizationErrorPage(error.message));
        return;
      }
      if (error instanceof RedirectableAuthorizationError && params.redirect_uri) {
        response.redirect(
          302,
          buildRedirect(params.redirect_uri, {
            error: error.code,
            error_description: error.description,
            state: params.state,
            iss: urls.issuer,
          })
        );
        return;
      }
      throw error;
    }
  }

  @Get("requests/:id")
  @UseGuards(JwtAuthGuard)
  view(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.authorization.view(user, id);
  }

  @Post("requests/:id/approve")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  approve(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApproveAuthorizationDto,
    @Req() request: Request
  ) {
    return this.authorization.approve(user, id, dto.storeId, this.urls.for(request));
  }

  @Post("requests/:id/deny")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  deny(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.authorization.deny(user, id, this.urls.for(request));
  }
}

/** Keeps only single string values (repeated OAuth parameters are invalid). */
export function stringParams(query: Record<string, unknown>): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, typeof value === "string" ? value : undefined])
  );
}
