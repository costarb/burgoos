import { INestApplication } from "@nestjs/common";
import { AccessAuditEventType, McpDataArea, UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessAuditService } from "../src/management/access/access-audit.service";
import { StoreMcpAdminController } from "../src/management/mcp/admin/store-mcp-admin.controller";
import { StoreMcpConfigurationService } from "../src/management/mcp/admin/store-mcp-configuration.service";
import { StoreMcpTokenService } from "../src/management/mcp/admin/store-mcp-token.service";
import { hashMcpToken } from "../src/management/mcp/admin/mcp-token.util";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import { createMcpTestApp } from "./support/mcp-test-app";

const storeA = "11111111-1111-4111-8111-111111111111";
const storeB = "22222222-2222-4222-8222-222222222222";
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("store MCP admin integration", () => {
  let app: INestApplication;
  const prisma = createMcpFakePrisma();
  const authMock = { verifyAccessToken: vi.fn() };

  beforeAll(async () => {
    app = await createMcpTestApp({
      prisma,
      authService: authMock,
      controllers: [StoreMcpAdminController],
      providers: [StoreMcpConfigurationService, StoreMcpTokenService, AccessAuditService],
      env: { MCP_PUBLIC_URL: "https://api.example.com/api/mcp" },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetMcpFakePrisma(prisma);
    prisma.state.tenants.push(
      { id: storeA, name: "Loja Centro", slug: "loja-centro", active: true, deactivatedAt: null },
      { id: storeB, name: "Loja Sul", slug: "loja-sul", active: true, deactivatedAt: null }
    );
    prisma.state.users.push({ id: adminId, name: "Admin Centro" });
    authMock.verifyAccessToken.mockResolvedValue(storeAdmin());
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());

  it("returns a disabled configuration with every area by default", async () => {
    const response = await http()
      .get("/api/admin/mcp/configuration")
      .set("Authorization", "Bearer admin")
      .expect(200);

    expect(response.body).toMatchObject({
      enabled: false,
      enabledAreas: Object.values(McpDataArea),
      serverUrl: "https://api.example.com/api/mcp",
    });
    expect(response.body.availableAreas).toHaveLength(6);
  });

  it("enables the MCP and audits the change", async () => {
    const response = await http()
      .put("/api/admin/mcp/configuration")
      .set("Authorization", "Bearer admin")
      .send({ enabled: true, enabledAreas: ["SALES", "FINANCIAL"] })
      .expect(200);

    expect(response.body).toMatchObject({
      enabled: true,
      enabledAreas: ["SALES", "FINANCIAL"],
      updatedBy: "Admin Centro",
    });
    expect(prisma.state.audits).toEqual([
      expect.objectContaining({
        eventType: AccessAuditEventType.MCP_CONFIGURATION_CHANGED,
        storeId: storeA,
        actorUserId: adminId,
        metadata: {
          before: { enabled: false, enabledAreas: [] },
          after: { enabled: true, enabledAreas: ["SALES", "FINANCIAL"] },
        },
      }),
    ]);
  });

  it("rejects an enabled configuration without areas", async () => {
    const response = await http()
      .put("/api/admin/mcp/configuration")
      .set("Authorization", "Bearer admin")
      .send({ enabled: true, enabledAreas: [] })
      .expect(400);

    expect(response.body.code).toBe("AREAS_REQUIRED");
    expect(prisma.state.configurations).toHaveLength(0);
  });

  it("requires the MCP to be enabled before generating tokens", async () => {
    const response = await http()
      .post("/api/admin/mcp/tokens")
      .set("Authorization", "Bearer admin")
      .send({ name: "Notebook", expiresInDays: 30 })
      .expect(409);

    expect(response.body.code).toBe("MCP_DISABLED");
  });

  it("returns the token only once, stores its hash and audits without the secret", async () => {
    enableMcp(storeA);

    const created = await http()
      .post("/api/admin/mcp/tokens")
      .set("Authorization", "Bearer admin")
      .send({ name: "  Notebook do Robson  ", expiresInDays: 90 })
      .expect(201);

    expect(created.body.token).toMatch(/^rrf_mcp_[A-Za-z0-9_-]{43}$/);
    expect(created.body).toMatchObject({
      name: "Notebook do Robson",
      status: "ACTIVE",
      tokenPrefix: created.body.token.slice(0, 14),
      createdBy: "Admin Centro",
    });
    expect(created.body.snippets.claudeCode).toContain(created.body.token);
    expect(created.body.snippets.claudeCode).toContain("rrfive-loja-centro");
    expect(prisma.state.tokens[0].tokenHash).toBe(hashMcpToken(created.body.token));
    expect(JSON.stringify(prisma.state.tokens)).not.toContain(created.body.token);
    expect(JSON.stringify(prisma.state.audits)).not.toContain(created.body.token);
    expect(prisma.state.audits[0]).toMatchObject({
      eventType: AccessAuditEventType.MCP_TOKEN_CREATED,
    });

    const listed = await http()
      .get("/api/admin/mcp/tokens")
      .set("Authorization", "Bearer admin")
      .expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].token).toBeUndefined();
    expect(JSON.stringify(listed.body)).not.toContain(created.body.token);
  });

  it("limits each store to ten active tokens", async () => {
    enableMcp(storeA);
    for (let index = 0; index < 10; index += 1) {
      seedToken(storeA, `token-${index}`);
    }
    seedToken(storeA, "revogado", { revokedAt: new Date() });
    seedToken(storeA, "expirado", { expiresAt: new Date("2020-01-01T00:00:00Z") });

    const response = await http()
      .post("/api/admin/mcp/tokens")
      .set("Authorization", "Bearer admin")
      .send({ name: "Excedente", expiresInDays: 30 })
      .expect(409);

    expect(response.body.code).toBe("TOKEN_LIMIT_REACHED");
  });

  it("revokes tokens idempotently and audits once", async () => {
    enableMcp(storeA);
    const token = seedToken(storeA, "Notebook");

    const first = await http()
      .post(`/api/admin/mcp/tokens/${token.id}/revoke`)
      .set("Authorization", "Bearer admin")
      .expect(200);
    await http()
      .post(`/api/admin/mcp/tokens/${token.id}/revoke`)
      .set("Authorization", "Bearer admin")
      .expect(200);

    expect(first.body.status).toBe("REVOKED");
    expect(
      prisma.state.audits.filter((event) => event.eventType === "MCP_TOKEN_REVOKED")
    ).toHaveLength(1);
  });

  it("does not let a store revoke another store's token", async () => {
    const token = seedToken(storeB, "Loja Sul");

    await http()
      .post(`/api/admin/mcp/tokens/${token.id}/revoke`)
      .set("Authorization", "Bearer admin")
      .expect(404);
    expect(token.revokedAt).toBeNull();
  });

  it("scopes the master user to the active store", async () => {
    seedToken(storeA, "Centro");
    seedToken(storeB, "Sul");
    authMock.verifyAccessToken.mockResolvedValue({ ...storeAdmin(), isMaster: true, tenantId: storeB });

    const listed = await http()
      .get("/api/admin/mcp/tokens")
      .set("Authorization", "Bearer master")
      .expect(200);

    expect(listed.body.map((token: { name: string }) => token.name)).toEqual(["Sul"]);
  });

  it("denies users without mcp.manage and platform admins", async () => {
    authMock.verifyAccessToken.mockResolvedValue({
      ...storeAdmin(),
      role: UserRole.OPERATOR,
      permissions: ["finance.view"],
    });
    await http().get("/api/admin/mcp/configuration").set("Authorization", "Bearer op").expect(403);

    authMock.verifyAccessToken.mockResolvedValue({
      ...storeAdmin(),
      role: UserRole.OPERATOR,
      permissions: ["mcp.manage"],
    });
    await http().get("/api/admin/mcp/configuration").set("Authorization", "Bearer op").expect(200);

    authMock.verifyAccessToken.mockResolvedValue({ ...storeAdmin(), isPlatformAdmin: true });
    await http()
      .get("/api/admin/mcp/configuration")
      .set("Authorization", "Bearer platform")
      .expect(403);
  });

  function storeAdmin() {
    return {
      sub: adminId,
      tenantId: storeA,
      role: UserRole.ADMIN,
      email: "admin@example.com",
      name: "Admin Centro",
      isMaster: false,
      activeStoreId: storeA,
      allowedStoreIds: [storeA],
      manageableStoreIds: [storeA],
      permissions: [],
    };
  }

  function enableMcp(tenantId: string, enabledAreas = Object.values(McpDataArea)) {
    prisma.state.configurations.push({
      id: `config-${tenantId}`,
      tenantId,
      enabled: true,
      enabledAreas,
      updatedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  function seedToken(
    tenantId: string,
    name: string,
    overrides: Partial<{ revokedAt: Date | null; expiresAt: Date | null }> = {}
  ) {
    const token = {
      id: crypto.randomUUID(),
      tenantId,
      name,
      tokenHash: hashMcpToken(`${tenantId}-${name}`),
      tokenPrefix: "rrf_mcp_seeded",
      expiresAt: null,
      revokedAt: null,
      revokedByUserId: null,
      lastUsedAt: null,
      createdByUserId: adminId,
      createdAt: new Date(),
      ...overrides,
    };
    prisma.state.tokens.push(token);
    return token;
  }
});
