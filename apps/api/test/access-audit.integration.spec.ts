import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccessAuditEventType, AccessAuditResult, UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AccessAuditService } from "../src/management/access/access-audit.service";
import { AuthService } from "../src/platform/auth/auth.service";

describe("access audit integration", () => {
  let app: INestApplication;

  const authMock = {
    verifyAccessToken: vi.fn(),
  };

  const auditMock = {
    query: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authMock)
      .overrideProvider(AccessAuditService)
      .useValue(auditMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("passes master audit queries without local store restriction", async () => {
    authMock.verifyAccessToken.mockResolvedValue(masterPayload());
    auditMock.query.mockResolvedValue([
      {
        id: "audit-1",
        storeId: "22222222-2222-4222-8222-222222222222",
        eventType: AccessAuditEventType.USER_UPDATED,
        result: AccessAuditResult.SUCCESS,
        metadata: { changedFields: ["name"] },
      },
    ]);

    const response = await request(app.getHttpServer())
      .get("/api/admin/access/audit?storeId=22222222-2222-4222-8222-222222222222")
      .set("Authorization", "Bearer master-token")
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(auditMock.query).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "master-1",
        isMaster: true,
      }),
      expect.objectContaining({
        storeId: "22222222-2222-4222-8222-222222222222",
      })
    );
  });

  it("passes store-admin manageable stores to scoped audit queries", async () => {
    authMock.verifyAccessToken.mockResolvedValue(storeAdminPayload());
    auditMock.query.mockResolvedValue([
      {
        id: "audit-2",
        storeId: "11111111-1111-4111-8111-111111111111",
        eventType: AccessAuditEventType.ACCESS_DENIED,
        result: AccessAuditResult.DENIED,
        metadata: { reason: "STORE_ADMIN_USER_SCOPE" },
      },
    ]);

    await request(app.getHttpServer())
      .get("/api/admin/access/audit?storeId=11111111-1111-4111-8111-111111111111")
      .set("Authorization", "Bearer store-admin-token")
      .expect(200);

    expect(auditMock.query).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "admin-1",
        manageableStoreIds: ["11111111-1111-4111-8111-111111111111"],
      }),
      expect.objectContaining({
        storeId: "11111111-1111-4111-8111-111111111111",
      })
    );
  });

  it("requires a bearer token for audit access", async () => {
    await request(app.getHttpServer()).get("/api/admin/access/audit").expect(401);
    expect(auditMock.query).not.toHaveBeenCalled();
  });

  function masterPayload() {
    return {
      sub: "master-1",
      tenantId: "11111111-1111-4111-8111-111111111111",
      role: UserRole.ADMIN,
      email: "master@example.com",
      name: "Master",
      isMaster: true,
      manageableStoreIds: [],
      allowedStoreIds: [],
      permissions: ["access.audit.view"],
    };
  }

  function storeAdminPayload() {
    return {
      sub: "admin-1",
      tenantId: "11111111-1111-4111-8111-111111111111",
      role: UserRole.ADMIN,
      email: "admin@example.com",
      name: "Store Admin",
      isMaster: false,
      activeStoreId: "11111111-1111-4111-8111-111111111111",
      manageableStoreIds: ["11111111-1111-4111-8111-111111111111"],
      allowedStoreIds: ["11111111-1111-4111-8111-111111111111"],
      permissions: ["access.audit.view"],
    };
  }
});
