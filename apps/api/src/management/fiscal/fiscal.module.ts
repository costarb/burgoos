import { Module } from "@nestjs/common";
import { AuthModule } from "../../platform/auth/auth.module";
import { AccessAuditService } from "../access/access-audit.service";
import { FiscalConfigurationController } from "./configuration/fiscal-configuration.controller";
import { FiscalConfigurationService } from "./configuration/fiscal-configuration.service";
import { FiscalIssuerService } from "./configuration/fiscal-issuer.service";
import { FiscalReadinessService } from "./configuration/fiscal-readiness.service";
import { IbgeMunicipalityClient } from "./configuration/ibge-municipality.client";
import { FiscalAuditService } from "./documents/fiscal-audit.service";
import { FiscalProfileController } from "./profiles/fiscal-profile.controller";
import { FiscalProfileResolver } from "./profiles/fiscal-profile-resolver";
import { FiscalProfileService } from "./profiles/fiscal-profile.service";
import { FiscalProviderRegistry } from "./providers/fiscal-provider.registry";

@Module({
  imports: [AuthModule],
  controllers: [FiscalConfigurationController, FiscalProfileController],
  providers: [
    AccessAuditService,
    FiscalProviderRegistry,
    FiscalAuditService,
    IbgeMunicipalityClient,
    FiscalIssuerService,
    FiscalProfileService,
    FiscalProfileResolver,
    FiscalReadinessService,
    FiscalConfigurationService,
  ],
  exports: [FiscalProviderRegistry, FiscalAuditService, FiscalConfigurationService, FiscalProfileResolver],
})
export class FiscalModule {}
