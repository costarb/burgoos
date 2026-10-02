import { Module } from "@nestjs/common";
import { BackgroundJobsModule } from "../../common/background-jobs/background-jobs.module";
import { ObservabilityModule } from "../../common/observability/observability.module";
import { OperationsModule } from "../../operations/operations.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { ManagementModule } from "../management.module";
import { StoreMcpAdminController } from "./admin/store-mcp-admin.controller";
import { StoreMcpConfigurationService } from "./admin/store-mcp-configuration.service";
import { StoreMcpTokenService } from "./admin/store-mcp-token.service";
import { McpUsageService } from "./admin/mcp-usage.service";
import { McpCallRetentionService } from "./server/mcp-call-retention.service";
import { CimdFetcher } from "./oauth/cimd-fetcher";
import { OAuthAuthorizationService } from "./oauth/oauth-authorization.service";
import { OAuthAuthorizeController } from "./oauth/oauth-authorize.controller";
import { OAuthClientService } from "./oauth/oauth-client.service";
import { OAuthConnectionService } from "./oauth/oauth-connection.service";
import { OAuthCredentialResolver } from "./oauth/oauth-credential.resolver";
import { OAuthRetentionService } from "./oauth/oauth-retention.service";
import { OAuthTokenController } from "./oauth/oauth-token.controller";
import { OAuthTokenService } from "./oauth/oauth-token.service";
import { OAuthUrlsProvider } from "./oauth/oauth-urls.provider";
import { StoreEligibilityService } from "./oauth/store-eligibility";
import { WellKnownController } from "./oauth/well-known.controller";
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

export const MCP_OAUTH_PROVIDERS = [
  OAuthUrlsProvider,
  CimdFetcher,
  OAuthClientService,
  StoreEligibilityService,
  OAuthConnectionService,
  OAuthAuthorizationService,
  OAuthTokenService,
  OAuthCredentialResolver,
];

export const MCP_OAUTH_CONTROLLERS = [WellKnownController, OAuthAuthorizeController, OAuthTokenController];

export const MCP_SERVER_PROVIDERS = [
  ...MCP_OAUTH_PROVIDERS,
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
  controllers: [StoreMcpAdminController, McpController, ...MCP_OAUTH_CONTROLLERS],
  providers: [
    StoreMcpConfigurationService,
    StoreMcpTokenService,
    McpUsageService,
    McpCallRetentionService,
    OAuthRetentionService,
    ...MCP_SERVER_PROVIDERS,
  ],
})
export class McpModule {}
