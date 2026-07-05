import { BadRequestException, Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CatalogService } from "../catalog.service";

@ApiTags("public menu")
@Controller("public/tenants")
export class PublicMenuController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get(":slug/menu")
  getMenu(@Param("slug") slug: string, @Req() request: Request) {
    return this.catalogService.getPublicMenu(slug, requestOrigin(request));
  }

  @Get(":slug/products/:productId/image")
  async getProductImage(
    @Param("slug") slug: string,
    @Param("productId") productId: string,
    @Res() response: Response
  ) {
    const asset = await this.catalogService.getPublicProductImage(slug, productId);
    sendImageAsset(response, asset.value);
  }

  @Get(":slug/branding/:asset")
  async getBrandingImage(
    @Param("slug") slug: string,
    @Param("asset") asset: string,
    @Res() response: Response
  ) {
    if (!isBrandingAsset(asset)) {
      throw new BadRequestException("Invalid branding asset");
    }

    const image = await this.catalogService.getPublicBrandingImage(slug, asset);
    sendImageAsset(response, image.value);
  }
}

function requestOrigin(request: Request): string {
  const forwardedProto = firstForwardedValue(request.header("x-forwarded-proto"));
  const forwardedHost = firstForwardedValue(request.header("x-forwarded-host"));
  const protocol = forwardedProto ?? request.protocol;
  const host = forwardedHost ?? request.get("host");

  return `${protocol}://${host}`;
}

function firstForwardedValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function isBrandingAsset(value: string): value is "logo" | "header" | "body" | "footer" {
  return ["logo", "header", "body", "footer"].includes(value);
}

function sendImageAsset(response: Response, value: string): void {
  if (isHttpUrl(value)) {
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.redirect(302, value);
    return;
  }

  const dataUrl = parseImageDataUrl(value);
  if (!dataUrl) {
    throw new BadRequestException("Invalid image asset");
  }

  response.setHeader("Content-Type", dataUrl.mediaType);
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.send(dataUrl.buffer);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseImageDataUrl(value: string): { mediaType: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value);
  if (!match?.[1] || !match[2] || !match[1].startsWith("image/")) {
    return null;
  }

  return {
    mediaType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}
