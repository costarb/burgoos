import { Module } from "@nestjs/common";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { AuthModule } from "../auth/auth.module";
import { MercadoPagoPlatformConfigurationController } from "./mercado-pago-platform-configuration.controller";
import { MercadoPagoPlatformConfigurationService } from "./mercado-pago-platform-configuration.service";
import { PagBankPlatformConfigurationController } from "./pagbank-platform-configuration.controller";
import { PagBankPlatformConfigurationService } from "./pagbank-platform-configuration.service";

@Module({
  imports: [AuthModule],
  controllers: [MercadoPagoPlatformConfigurationController, PagBankPlatformConfigurationController],
  providers: [
    IntegrationSecretService,
    MercadoPagoPlatformConfigurationService,
    PagBankPlatformConfigurationService,
  ],
  exports: [
    IntegrationSecretService,
    MercadoPagoPlatformConfigurationService,
    PagBankPlatformConfigurationService,
  ],
})
export class PlatformIntegrationsModule {}
