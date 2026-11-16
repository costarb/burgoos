import { Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { contentTypeForKey } from "./asset-content-type";
import { LocalAssetStorageService } from "./local-asset-storage.service";

/**
 * Development only (ASSET_STORAGE_PROVIDER=local): serves files through the HMAC signed URLs built by
 * LocalAssetStorageService.createReadUrl, the local counterpart of S3 presigned GET URLs (spec 030).
 */
@Controller("assets/local")
export class LocalAssetReadController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(LocalAssetStorageService) private readonly storage: LocalAssetStorageService
  ) {}

  @Get(":assetKey")
  async read(
    @Param("assetKey") key: string,
    @Query("exp") exp: string,
    @Query("sig") sig: string,
    @Res() response: Response
  ): Promise<void> {
    if (this.config.get<string>("ASSET_STORAGE_PROVIDER") === "s3") throw new NotFoundException();
    if (!this.storage.verifyReadSignature(key, Number(exp), sig ?? "")) throw new ForbiddenException();
    let asset;
    try {
      asset = await this.storage.read(key);
    } catch {
      throw new NotFoundException();
    }
    response.setHeader("Content-Type", asset.contentType ?? contentTypeForKey(key));
    if (asset.contentLength !== undefined) response.setHeader("Content-Length", String(asset.contentLength));
    response.setHeader("Cache-Control", "private, max-age=300");
    asset.body.pipe(response);
  }
}
