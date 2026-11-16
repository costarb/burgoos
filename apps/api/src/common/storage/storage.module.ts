import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ASSET_STORAGE } from "./asset-storage";
import { LocalAssetStorageService } from "./local-asset-storage.service";
import { S3AssetStorageService } from "./s3-asset-storage.service";
import { AssetUploadController } from "./asset-upload.controller";
import { LocalAssetReadController } from "./local-asset-read.controller";
import { isTemporaryStorage } from "./storage-health";
import { AssetUploadService } from "./asset-upload.service";
import { AuthModule } from "../../platform/auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AssetUploadController, LocalAssetReadController],
  providers: [
    AssetUploadService,
    LocalAssetStorageService,
    S3AssetStorageService,
    {
      provide: ASSET_STORAGE,
      inject: [ConfigService, LocalAssetStorageService, S3AssetStorageService],
      useFactory: (
        config: ConfigService,
        local: LocalAssetStorageService,
        s3: S3AssetStorageService
      ) => {
        const provider = config.get<string>("ASSET_STORAGE_PROVIDER");
        if (isTemporaryStorage({ nodeEnv: config.get<string>("NODE_ENV") ?? process.env.NODE_ENV, provider })) {
          new Logger("Storage").warn(JSON.stringify({ event: "storage.local_in_production", provider: provider ?? "local" }));
        }
        return provider === "s3" ? s3 : local;
      },
    },
  ],
  exports: [ASSET_STORAGE],
})
export class StorageModule {}
