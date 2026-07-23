import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CatalogService } from "../catalog.service";

@ApiTags("public menu")
@Controller("public/domains")
export class PublicDomainMenuController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get(":domain/menu")
  getMenu(@Param("domain") domain: string, @Req() request: Request) {
    return this.catalogService.getPublicMenuByDomain(domain, requestOrigin(request));
  }
}

function requestOrigin(request: Request): string {
  const protocol = firstForwardedValue(request.header("x-forwarded-proto")) ?? request.protocol;
  const host = firstForwardedValue(request.header("x-forwarded-host")) ?? request.get("host");
  return `${protocol}://${host}`;
}

function firstForwardedValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}
