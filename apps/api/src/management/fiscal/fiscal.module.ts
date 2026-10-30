import { Module } from "@nestjs/common";
import { AuthModule } from "../../platform/auth/auth.module";
import { FiscalAuditService } from "./documents/fiscal-audit.service";
import { FiscalProviderRegistry } from "./providers/fiscal-provider.registry";

@Module({
  imports: [AuthModule],
  providers: [FiscalProviderRegistry, FiscalAuditService],
  exports: [FiscalProviderRegistry, FiscalAuditService],
})
export class FiscalModule {}
