import { Module } from "@nestjs/common";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { AuthModule } from "../auth/auth.module";
import { BlingPlatformConfigurationController } from "./bling-platform-configuration.controller";
import { BlingPlatformConfigurationService } from "./bling-platform-configuration.service";
import { MercadoPagoPlatformConfigurationController } from "./mercado-pago-platform-configuration.controller";
import { MercadoPagoPlatformConfigurationService } from "./mercado-pago-platform-configuration.service";
import { PagBankPlatformConfigurationController } from "./pagbank-platform-configuration.controller";
import { PagBankPlatformConfigurationService } from "./pagbank-platform-configuration.service";

@Module({
  imports: [AuthModule],
  controllers: [
    MercadoPagoPlatformConfigurationController,
    PagBankPlatformConfigurationController,
    BlingPlatformConfigurationController,
  ],
  providers: [
    IntegrationSecretService,
    MercadoPagoPlatformConfigurationService,
    PagBankPlatformConfigurationService,
    BlingPlatformConfigurationService,
  ],
  exports: [
    IntegrationSecretService,
    MercadoPagoPlatformConfigurationService,
    PagBankPlatformConfigurationService,
    BlingPlatformConfigurationService,
  ],
})
export class PlatformIntegrationsModule {}
