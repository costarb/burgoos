import { Body, Controller, HttpCode, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from "class-validator";
import type { Request } from "express";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { AssetUploadService, ImageContentType, ImagePurpose, imagePurposes } from "./asset-upload.service";

class CreateAssetUploadIntentDto {
  @IsIn(imagePurposes) purpose!: ImagePurpose;
  @IsString() @MaxLength(200) fileName!: string;
  @IsIn(["image/png", "image/jpeg", "image/webp"]) contentType!: ImageContentType;
  @IsInt() @Min(1) @Max(2 * 1024 * 1024) sizeBytes!: number;
  @IsInt() @Min(1) @Max(4096) width!: number;
  @IsInt() @Min(1) @Max(4096) height!: number;
}

@Controller("admin/assets")
@UseGuards(JwtAuthGuard)
export class AssetUploadController {
  constructor(@Inject(AssetUploadService) private readonly uploads: AssetUploadService) {}

  @Post("upload-intents")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetUploadIntentDto) {
    return this.uploads.createIntent(user.tenantId, dto);
  }

  @Put("local-uploads/:assetKey")
  @HttpCode(204)
  async uploadLocal(@CurrentUser() user: AuthUser, @Param("assetKey") key: string, @Req() request: Request) {
    await this.uploads.uploadLocal(user.tenantId, key, request.header("content-type") ?? "", request);
  }

  @Post("upload-intents/:assetKey/confirm")
  confirm(@CurrentUser() user: AuthUser, @Param("assetKey") key: string) {
    return this.uploads.confirm(user.tenantId, key);
  }
}
