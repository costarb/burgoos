import { INestApplication } from "@nestjs/common";
import { McpDataArea, UserRole } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import request from "supertest";
import { vi } from "vitest";
import { MemoryPressureService } from "../../src/common/observability/memory-pressure.service";
import { AccessAuditService } from "../../src/management/access/access-audit.service";
import { AccountsPayableService } from "../../src/management/financial/accounts-payable/accounts-payable.service";
import { CashFlowService } from "../../src/management/financial/cash-flow/cash-flow.service";
import { McpUsageService } from "../../src/management/mcp/admin/mcp-usage.service";
import { StoreMcpAdminController } from "../../src/management/mcp/admin/store-mcp-admin.controller";
import { StoreMcpConfigurationService } from "../../src/management/mcp/admin/store-mcp-configuration.service";
import { StoreMcpTokenService } from "../../src/management/mcp/admin/store-mcp-token.service";
import { MCP_OAUTH_CONTROLLERS, MCP_SERVER_PROVIDERS } from "../../src/management/mcp/mcp.module";
import { CimdFetcher } from "../../src/management/mcp/oauth/cimd-fetcher";
import { McpController } from "../../src/management/mcp/server/mcp.controller";
import { ReportsService } from "../../src/management/reports.service";
import { DreService } from "../../src/management/reports/dre.service";
import { FinancialDashboardService } from "../../src/management/reports/financial-dashboard.service";
import { ManagementReportService } from "../../src/management/reports/management-report.service";
import { MenuEngineeringService } from "../../src/management/reports/menu-engineering.service";
import { SalesReportService } from "../../src/management/reports/sales-report.service";
import { SalesImportPreviewService } from "../../src/management/sales-integrations/sales-import-preview.service";
import { SalesImportRunProcessor } from "../../src/management/sales-integrations/sales-import-run.processor";
import { InventoryService } from "../../src/operations/inventory/inventory.service";
import type { McpFakePrisma } from "./mcp-fake-prisma";
import { createServiceMocks, memoryPressureMock, ServiceMocks, STORE_A, STORE_B, STORE_DATA } from "./mcp-service-fixtures";
import { createMcpTestApp } from "./mcp-test-app";

export const MCP_URL = "https://api.example.com/api/mcp";
export const ISSUER = "https://api.example.com";
export const WEB_URL = "https://app.example.com";
export const CIMD_CLIENT_ID = "https://client.example.com/oauth/client.json";
export const CLIENT_REDIRECT = "https://client.example.com/callback";
export const LOOPBACK_CLIENT_ID = "https://cli.example.com/client.json";

export const USERS = {
  owner: "aaaaaaaa-0000-4000-8000-000000000001",
  operatorWithPermission: "aaaaaaaa-0000-4000-8000-000000000002",
  operatorWithout: "aaaaaaaa-0000-4000-8000-000000000003",
  multiStore: "aaaaaaaa-0000-4000-8000-000000000004",
  platformAdmin: "aaaaaaaa-0000-4000-8000-000000000005",
} as const;

export const authMock = { verifyAccessToken: vi.fn() };

/** JWT payload per user id (the Bearer value in tests is the user id). */
export function jwtPayload(userId: string) {
  const base = {
    sub: userId,
    tenantId: STORE_A,
    role: UserRole.OPERATOR,
    email: `${userId}@example.com`,
    name: `User ${userId.slice(-1)}`,
    isMaster: false,
    allowedStoreIds: [STORE_A],
    manageableStoreIds: [],
    permissions: [] as string[],
  };
  switch (userId) {
    case USERS.owner:
      return { ...base, role: UserRole.OWNER, name: "Dono Centro" };
    case USERS.multiStore:
      return { ...base, role: UserRole.ADMIN, name: "Gestor Multi", allowedStoreIds: [STORE_A, STORE_B] };
    case USERS.platformAdmin:
      return { ...base, isPlatformAdmin: true, name: "Plataforma" };
    default:
      return base;
  }
}

export function createCimdFetcher(): CimdFetcher {
  const fetcher = new CimdFetcher();
  const documents: Record<string, unknown> = {
    [CIMD_CLIENT_ID]: {
      client_id: CIMD_CLIENT_ID,
      client_name: "Claude",
      redirect_uris: [CLIENT_REDIRECT],
    },
    [LOOPBACK_CLIENT_ID]: {
      client_id: LOOPBACK_CLIENT_ID,
      client_name: "Claude Code",
      redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
    },
  };
  fetcher.lookupImpl = async () => [{ address: "93.184.216.34", family: 4 }];
  fetcher.fetchImpl = (async (input: string | URL | Request) => {
    const document = documents[String(input)];
    return document
      ? new Response(JSON.stringify(document), { status: 200, headers: { "content-type": "application/json" } })
      : new Response("not found", { status: 404 });
  }) as typeof fetch;
  return fetcher;
}

export async function createOAuthApp(
  prisma: McpFakePrisma,
  services: ServiceMocks = createServiceMocks(),
  env: Record<string, string> = {}
): Promise<INestApplication> {
  return createMcpTestApp({
    prisma,
    authService: authMock,
    controllers: [McpController, StoreMcpAdminController, ...MCP_OAUTH_CONTROLLERS],
    env: { MCP_PUBLIC_URL: MCP_URL, WEB_PUBLIC_URL: WEB_URL, ...env },
    providers: [
      ...MCP_SERVER_PROVIDERS,
      AccessAuditService,
      StoreMcpConfigurationService,
      StoreMcpTokenService,
      McpUsageService,
      { provide: CimdFetcher, useValue: createCimdFetcher() },
      { provide: MemoryPressureService, useValue: memoryPressureMock },
      { provide: SalesReportService, useValue: services.sales },
      { provide: ReportsService, useValue: services.reports },
      { provide: ManagementReportService, useValue: services.management },
      { provide: DreService, useValue: services.dre },
      { provide: FinancialDashboardService, useValue: services.dashboard },
      { provide: MenuEngineeringService, useValue: services.menu },
      { provide: CashFlowService, useValue: services.cashFlow },
      { provide: AccountsPayableService, useValue: services.payables },
      { provide: InventoryService, useValue: services.inventory },
      { provide: SalesImportPreviewService, useValue: services.salesImport },
      { provide: SalesImportRunProcessor, useValue: services.salesImportProcessor },
    ],
  });
}

/** Two stores with MCP enabled and the standard users. */
export function seedOAuthWorld(prisma: McpFakePrisma, options: { storeBEnabled?: boolean } = {}) {
  authMock.verifyAccessToken.mockImplementation(async (token: string) => jwtPayload(token));
  for (const tenantId of [STORE_A, STORE_B] as const) {
    prisma.state.tenants.push({
      id: tenantId,
      name: STORE_DATA[tenantId].name,
      slug: STORE_DATA[tenantId].slug,
      active: true,
      deactivatedAt: null,
    });
    prisma.state.configurations.push({
      id: `config-${tenantId}`,
      tenantId,
      enabled: tenantId === STORE_B ? (options.storeBEnabled ?? true) : true,
      enabledAreas: Object.values(McpDataArea),
      updatedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  prisma.state.users.push(
    { id: USERS.owner, name: "Dono Centro", tenantId: STORE_A, role: "OWNER", status: "ACTIVE" },
    { id: USERS.operatorWithPermission, name: "Operador IA", tenantId: STORE_A, role: "OPERATOR", status: "ACTIVE" },
    { id: USERS.operatorWithout, name: "Operador", tenantId: STORE_A, role: "OPERATOR", status: "ACTIVE" },
    { id: USERS.multiStore, name: "Gestor Multi", tenantId: STORE_A, role: "ADMIN", status: "ACTIVE" },
    { id: USERS.platformAdmin, name: "Plataforma", tenantId: STORE_A, role: "OPERATOR", status: "ACTIVE" }
  );
  prisma.state.assignments.push(
    { userId: USERS.operatorWithPermission, tenantId: STORE_A, status: "ACTIVE", permissions: ["mcp.connect"] },
    { userId: USERS.operatorWithout, tenantId: STORE_A, status: "ACTIVE", permissions: ["finance.view"] },
    { userId: USERS.multiStore, tenantId: STORE_B, status: "ACTIVE", permissions: [] }
  );
}

export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authorizeQuery(overrides: Record<string, string | undefined> = {}, challenge = pkce().challenge) {
  const params: Record<string, string | undefined> = {
    response_type: "code",
    client_id: CIMD_CLIENT_ID,
    redirect_uri: CLIENT_REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "estado-123",
    scope: "mcp:read",
    resource: MCP_URL,
    ...overrides,
  };
  return new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)
  ).toString();
}

/** Runs authorize → approve and returns the code plus the PKCE verifier. */
export async function obtainCode(
  app: INestApplication,
  options: { userId?: string; storeId?: string; clientId?: string; redirectUri?: string } = {}
) {
  const http = request(app.getHttpServer());
  const { verifier, challenge } = pkce();
  const redirectUri = options.redirectUri ?? CLIENT_REDIRECT;
  const authorize = await http
    .get(`/api/oauth/authorize?${authorizeQuery({ client_id: options.clientId ?? CIMD_CLIENT_ID, redirect_uri: redirectUri }, challenge)}`)
    .expect(302);
  const requestId = new URL(authorize.headers.location).searchParams.get("pedido")!;
  const approved = await http
    .post(`/api/oauth/requests/${requestId}/approve`)
    .set("Authorization", `Bearer ${options.userId ?? USERS.owner}`)
    .send({ storeId: options.storeId ?? STORE_A })
    .expect(200);
  const code = new URL(approved.body.redirectUrl).searchParams.get("code")!;
  return { code, verifier, requestId, redirectUri, clientId: options.clientId ?? CIMD_CLIENT_ID };
}

export function exchangeCode(app: INestApplication, grant: Awaited<ReturnType<typeof obtainCode>>) {
  return request(app.getHttpServer())
    .post("/api/oauth/token")
    .type("form")
    .send({
      grant_type: "authorization_code",
      code: grant.code,
      code_verifier: grant.verifier,
      redirect_uri: grant.redirectUri,
      client_id: grant.clientId,
      resource: MCP_URL,
    });
}
