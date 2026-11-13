import { Module } from "@nestjs/common";
import { IbgeMunicipalityClient } from "../../common/br/ibge-municipality.client";
import { AuthModule } from "../auth/auth.module";
import { PlatformStoreController } from "./platform-store.controller";
import { PlatformStoreService } from "./platform-store.service";
import { StoreLegalProfileService } from "./store-legal-profile.service";
import { StoreProfileController } from "./store-profile.controller";

@Module({
  imports: [AuthModule],
  controllers: [PlatformStoreController, StoreProfileController],
  providers: [PlatformStoreService, StoreLegalProfileService, IbgeMunicipalityClient],
  exports: [PlatformStoreService],
})
export class PlatformStoreModule {}
