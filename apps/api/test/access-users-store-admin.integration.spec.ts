import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AccessProfileScope,
  AccessProfileStatus,
  AccessUserStatus,
  UserRole,
} from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthCryptoService } from "../src/auth/auth-crypto.service";
import { AccessAuditService } from "../src/management/access/access-audit.service";
import { AuthService } from "../src/platform/auth/auth.service";
import { PrismaService } from "../src/platform/database/prisma.service";

const storeId = "11111111-1111-4111-8111-111111111111";
const otherStoreId = "22222222-2222-4222-8222-222222222222";

describe("access users store-admin integration", () => {
  let app: INestApplication;

  const prismaMock = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    userStoreAssignment: {
      deleteMany: vi.fn(),
    },
    tenant: {
      findMany: vi.fn(),
    },
    accessProfile: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  const authMock = {
    verifyAccessToken: vi.fn(),
  };
  const cryptoMock = {
    hashSecret: vi.fn(),
  };
  const auditMock = {
    record: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(AuthService)
      .useValue(authMock)
      .overrideProvider(AuthCryptoService)
      .useValue(cryptoMock)
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
    setupPrisma();
    authMock.verifyAccessToken.mockResolvedValue(storeAdminPayload());
    cryptoMock.hashSecret.mockResolvedValue("hashed-temp-password");
    auditMock.record.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lists only users assigned to the admin manageable store", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([userRecord()]);

    await request(app.getHttpServer())
      .get("/api/admin/access/users")
      .set("Authorization", "Bearer store-admin-token")
      .expect(200);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeAssignments: { some: { tenantId: { in: [storeId] } } },
        }),
      })
    );
  });

  it("creates local users inside the admin store scope", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      userRecord({ id: "created-local-user", email: "local@example.com" })
    );

    const response = await request(app.getHttpServer())
      .post("/api/admin/access/users")
      .set("Authorization", "Bearer store-admin-token")
      .send({
        login: "local@example.com",
        name: "Usuario Local",
        email: "local@example.com",
        isMaster: false,
        assignments: [
          {
            storeId,
            profileId: "profile-1",
            canManageStoreAccess: false,
            status: AccessProfileStatus.ACTIVE,
          },
        ],
      })
      .expect(201);

    expect(response.body).toMatchObject({ id: "created-local-user" });
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        targetUserId: "created-local-user",
        result: "SUCCESS",
      }),
      expect.anything()
    );
  });

  it("denies cross-tenant assignments and records an access denied event", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/access/users")
      .set("Authorization", "Bearer store-admin-token")
      .send({
        login: "fora@example.com",
        name: "Usuario Fora",
        email: "fora@example.com",
        isMaster: false,
        assignments: [
          {
            storeId: otherStoreId,
            profileId: "profile-2",
            canManageStoreAccess: false,
            status: AccessProfileStatus.ACTIVE,
          },
        ],
      })
      .expect(403);

    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        storeId: otherStoreId,
        eventType: "ACCESS_DENIED",
        result: "DENIED",
        reason: "STORE_ADMIN_ASSIGNMENT_SCOPE",
      })
    );
  });

  function setupPrisma(): void {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue(userRecord());
    prismaMock.user.create.mockResolvedValue(userRecord());
    prismaMock.user.update.mockResolvedValue(userRecord());
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.userStoreAssignment.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.tenant.findMany.mockResolvedValue([tenantRecord(storeId)]);
    prismaMock.accessProfile.findMany.mockResolvedValue([profileRecord()]);
    prismaMock.$transaction.mockImplementation(async (input) => {
      if (typeof input === "function") {
        return input({
          user: prismaMock.user,
          userStoreAssignment: prismaMock.userStoreAssignment,
        });
      }

      return Promise.all(input);
    });
  }

  function userRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: "user-1",
      tenantId: storeId,
      role: UserRole.OPERATOR,
      name: "Usuario Local",
      email: "local@example.com",
      phone: null,
      status: AccessUserStatus.ACTIVE,
      isMaster: false,
      lastLoginAt: null,
      storeAssignments: [
        {
          tenantId: storeId,
          canManageStoreAccess: false,
          status: AccessProfileStatus.ACTIVE,
          tenant: tenantRecord(storeId),
          profile: profileRecord(),
        },
      ],
      ...overrides,
    };
  }

  function tenantRecord(id = storeId) {
    return {
      id,
      name: id === storeId ? "Loja Centro" : "Loja Filial",
      slug: id === storeId ? "loja-centro" : "loja-filial",
      active: true,
    };
  }

  function profileRecord() {
    return {
      id: "profile-1",
      name: "Operacao",
      scope: AccessProfileScope.STORE,
      tenantId: storeId,
      status: AccessProfileStatus.ACTIVE,
    };
  }

  function storeAdminPayload() {
    return {
      sub: "admin-1",
      tenantId: storeId,
      role: UserRole.ADMIN,
      email: "admin@example.com",
      name: "Store Admin",
      isMaster: false,
      activeStoreId: storeId,
      allowedStoreIds: [storeId],
      manageableStoreIds: [storeId],
      permissions: ["access.users.manage"],
    };
  }
});
