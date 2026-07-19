import { Module } from "@nestjs/common";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { AuthModule } from "../auth/auth.module";
import { MercadoPagoPlatformConfigurationController } from "./mercado-pago-platform-configuration.controller";
import { MercadoPagoPlatformConfigurationService } from "./mercado-pago-platform-configuration.service";

@Module({
  imports: [AuthModule],
  controllers: [MercadoPagoPlatformConfigurationController],
  providers: [IntegrationSecretService, MercadoPagoPlatformConfigurationService],
  exports: [IntegrationSecretService, MercadoPagoPlatformConfigurationService],
})
export class PlatformIntegrationsModule {}
