import { Module } from "@nestjs/common";
import { BackgroundJobsModule } from "../../common/background-jobs/background-jobs.module";
import { ObservabilityModule } from "../../common/observability/observability.module";
import { OperationsModule } from "../../operations/operations.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { ManagementModule } from "../management.module";
import { StoreMcpAdminController } from "./admin/store-mcp-admin.controller";
import { StoreMcpConfigurationService } from "./admin/store-mcp-configuration.service";
import { StoreMcpTokenService } from "./admin/store-mcp-token.service";
import { McpResources } from "./resources/mcp-resources";
import { McpCallLogService } from "./server/mcp-call-log.service";
import { McpRateLimitGuard } from "./server/mcp-rate-limit.guard";
import { McpServerFactory, McpToolCatalog } from "./server/mcp-server.factory";
import { McpTokenGuard } from "./server/mcp-token.guard";
import { McpToolRunner } from "./server/mcp-tool-runner";
import { McpController } from "./server/mcp.controller";
import { CashTools } from "./tools/cash.tools";
import { FinancialTools } from "./tools/financial.tools";
import { InventoryTools } from "./tools/inventory.tools";
import { MenuTools } from "./tools/menu.tools";
import { PayablesTools } from "./tools/payables.tools";
import { SalesTools } from "./tools/sales.tools";

export const MCP_SERVER_PROVIDERS = [
  McpCallLogService,
  McpTokenGuard,
  McpRateLimitGuard,
  McpToolRunner,
  McpToolCatalog,
  McpServerFactory,
  McpResources,
  SalesTools,
  FinancialTools,
  MenuTools,
  CashTools,
  PayablesTools,
  InventoryTools,
];

@Module({
  imports: [AuthModule, ManagementModule, OperationsModule, ObservabilityModule, BackgroundJobsModule],
  controllers: [StoreMcpAdminController, McpController],
  providers: [StoreMcpConfigurationService, StoreMcpTokenService, ...MCP_SERVER_PROVIDERS],
})
export class McpModule {}
