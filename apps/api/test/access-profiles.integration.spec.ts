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
import { AccessAuditService } from "../src/management/access/access-audit.service";
import { AuthService } from "../src/platform/auth/auth.service";
import { PrismaService } from "../src/platform/database/prisma.service";

const storeId = "11111111-1111-4111-8111-111111111111";
const otherStoreId = "22222222-2222-4222-8222-222222222222";

describe("access profiles integration", () => {
  let app: INestApplication;

  const prismaMock = {
    accessProfile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    accessProfilePermission: {
      deleteMany: vi.fn(),
    },
    permission: {
      upsert: vi.fn(),
    },
    userStoreAssignment: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  const authMock = {
    verifyAccessToken: vi.fn(),
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
    auditMock.record.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates a store-scoped profile and grants requested permissions", async () => {
    prismaMock.accessProfile.create.mockResolvedValueOnce(
      profileRecord({
        id: "profile-created",
        tenantId: storeId,
        name: "Operacao",
        permissions: [{ permission: { key: "orders.view" } }],
      })
    );

    const response = await request(app.getHttpServer())
      .post("/api/admin/access/profiles")
      .set("Authorization", "Bearer master-token")
      .send({
        name: "Operacao",
        scope: AccessProfileScope.STORE,
        storeId,
        permissionKeys: ["orders.view"],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: "profile-created",
      tenantId: storeId,
      name: "Operacao",
    });
    expect(prismaMock.permission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "orders.view" } })
    );
    expect(prismaMock.accessProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: storeId,
          permissions: {
            create: [{ permission: { connect: { key: "orders.view" } } }],
          },
        }),
      })
    );
  });

  it("duplicates profiles with the source permission grants", async () => {
    prismaMock.accessProfile.findFirst
      .mockResolvedValueOnce(
        profileRecord({
          id: "profile-source",
          tenantId: storeId,
          permissions: [
            { permission: { key: "orders.view" } },
            { permission: { key: "finance.view" } },
          ],
        })
      )
      .mockResolvedValueOnce(null);
    prismaMock.accessProfile.create.mockResolvedValueOnce(
      profileRecord({
        id: "profile-copy",
        tenantId: storeId,
        name: "Copia Operacao",
        permissions: [],
      })
    );

    await request(app.getHttpServer())
      .post("/api/admin/access/profiles/profile-source/duplicate")
      .set("Authorization", "Bearer master-token")
      .send({ name: "Copia Operacao", storeId })
      .expect(201);

    expect(prismaMock.accessProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permissions: {
            create: [
              { permission: { connect: { key: "orders.view" } } },
              { permission: { connect: { key: "finance.view" } } },
            ],
          },
        }),
      })
    );
  });

  it("blocks inactivation of profiles assigned to active users", async () => {
    prismaMock.accessProfile.findFirst.mockResolvedValueOnce(
      profileRecord({ id: "profile-in-use", tenantId: storeId })
    );
    prismaMock.userStoreAssignment.count.mockResolvedValueOnce(1);

    const response = await request(app.getHttpServer())
      .patch("/api/admin/access/profiles/profile-in-use")
      .set("Authorization", "Bearer master-token")
      .send({ status: AccessProfileStatus.INACTIVE })
      .expect(409);

    expect(response.body.message).toBe("Perfil em uso por usuarios ativos");
    expect(prismaMock.accessProfile.update).not.toHaveBeenCalled();
  });

  it("exposes the grouped permission catalog to authenticated users", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/admin/access/permissions")
      .set("Authorization", "Bearer master-token")
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "Acessos",
          screens: expect.arrayContaining([
            expect.objectContaining({
              permissions: expect.arrayContaining([
                expect.objectContaining({ key: "access.users.manage" }),
              ]),
            }),
          ]),
        }),
      ])
    );
  });

  it("denies store admins creating profiles outside their store scope", async () => {
    authMock.verifyAccessToken.mockResolvedValueOnce(storeAdminPayload());

    await request(app.getHttpServer())
      .post("/api/admin/access/profiles")
      .set("Authorization", "Bearer store-admin-token")
      .send({
        name: "Outra loja",
        scope: AccessProfileScope.STORE,
        storeId: otherStoreId,
        permissionKeys: ["orders.view"],
      })
      .expect(409);
  });

  function setupPrisma(): void {
    prismaMock.permission.upsert.mockImplementation(async (input) => input);
    prismaMock.accessProfile.findFirst.mockResolvedValue(null);
    prismaMock.accessProfile.findMany.mockResolvedValue([]);
    prismaMock.accessProfile.create.mockResolvedValue(profileRecord());
    prismaMock.accessProfile.update.mockResolvedValue(profileRecord());
    prismaMock.accessProfilePermission.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.userStoreAssignment.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (input) => {
      if (typeof input === "function") {
        return input({
          accessProfile: prismaMock.accessProfile,
          accessProfilePermission: prismaMock.accessProfilePermission,
        });
      }

      return Promise.all(input);
    });
  }

  function profileRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: "profile-1",
      tenantId: storeId,
      name: "Perfil",
      description: null,
      scope: AccessProfileScope.STORE,
      status: AccessProfileStatus.ACTIVE,
      createdByUserId: null,
      updatedByUserId: null,
      permissions: [{ permission: { key: "orders.view" } }],
      ...overrides,
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
      permissions: ["access.profiles.manage"],
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
      status: AccessUserStatus.ACTIVE,
      activeStoreId: storeId,
      allowedStoreIds: [storeId],
      manageableStoreIds: [storeId],
      permissions: ["access.profiles.manage"],
    };
  }
});
