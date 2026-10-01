import { Module } from "@nestjs/common";
import { BackgroundJobsModule } from "../../common/background-jobs/background-jobs.module";
import { ObservabilityModule } from "../../common/observability/observability.module";
import { OperationsModule } from "../../operations/operations.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { ManagementModule } from "../management.module";
import { StoreMcpAdminController } from "./admin/store-mcp-admin.controller";
import { StoreMcpConfigurationService } from "./admin/store-mcp-configuration.service";
import { StoreMcpTokenService } from "./admin/store-mcp-token.service";

@Module({
  imports: [AuthModule, ManagementModule, OperationsModule, ObservabilityModule, BackgroundJobsModule],
  controllers: [StoreMcpAdminController],
  providers: [StoreMcpConfigurationService, StoreMcpTokenService],
})
export class McpModule {}
