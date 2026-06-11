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

describe("access users master integration", () => {
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
    authMock.verifyAccessToken.mockResolvedValue(masterPayload());
    cryptoMock.hashSecret.mockResolvedValue("hashed-temp-password");
    auditMock.record.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lists users with master filters across stores", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      userRecord({ id: "user-store-a", email: "a@example.com" }),
      userRecord({
        id: "user-store-b",
        email: "b@example.com",
        tenant: tenantRecord(otherStoreId, "Loja Filial"),
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get(`/api/admin/access/users?storeId=${storeId}&search=example`)
      .set("Authorization", "Bearer master-token")
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeAssignments: { some: { tenantId: storeId } },
          OR: expect.any(Array),
        }),
      })
    );
  });

  it("creates users with store assignments in any store", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      userRecord({ id: "created-user", email: "novo@example.com" })
    );

    const response = await request(app.getHttpServer())
      .post("/api/admin/access/users")
      .set("Authorization", "Bearer master-token")
      .send({
        login: "novo@example.com",
        name: "Novo Usuario",
        email: "novo@example.com",
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

    expect(response.body).toMatchObject({
      id: "created-user",
      login: "novo@example.com",
      assignments: expect.any(Array),
    });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: storeId,
          email: "novo@example.com",
          storeAssignments: {
            create: [
              {
                tenantId: storeId,
                profileId: "profile-1",
                canManageStoreAccess: false,
                status: AccessProfileStatus.ACTIVE,
              },
            ],
          },
        }),
      })
    );
  });

  it("blocks deactivating the last active master", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(
      userRecord({ id: "master-1", isMaster: true, status: AccessUserStatus.ACTIVE })
    );
    prismaMock.user.count.mockResolvedValueOnce(1);

    const response = await request(app.getHttpServer())
      .patch("/api/admin/access/users/master-1")
      .set("Authorization", "Bearer master-token")
      .send({ status: AccessUserStatus.INACTIVE })
      .expect(409);

    expect(response.body.message).toBe("Pelo menos um usuario master ativo deve permanecer");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  function setupPrisma(): void {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue(userRecord());
    prismaMock.user.create.mockResolvedValue(userRecord());
    prismaMock.user.update.mockResolvedValue(userRecord());
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.userStoreAssignment.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.tenant.findMany.mockResolvedValue([
      tenantRecord(storeId),
      tenantRecord(otherStoreId),
    ]);
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
      name: "Usuario",
      email: "usuario@example.com",
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

  function tenantRecord(id = storeId, name = "Loja Centro") {
    return {
      id,
      name,
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

  function masterPayload() {
    return {
      sub: "master-1",
      tenantId: storeId,
      role: UserRole.ADMIN,
      email: "master@example.com",
      name: "Master",
      isMaster: true,
      activeStoreId: storeId,
      allowedStoreIds: [storeId, otherStoreId],
      manageableStoreIds: [],
      permissions: ["access.users.manage"],
    };
  }
});
