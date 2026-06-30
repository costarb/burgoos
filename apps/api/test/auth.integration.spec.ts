import { INestApplication, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccessProfileStatus, AccessUserStatus, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PasswordResetService } from "../src/auth/password-reset.service";
import { SessionTokenService } from "../src/auth/session-token.service";
import { AccessAuditService } from "../src/management/access/access-audit.service";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const secondTenantId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

describe("auth integration", () => {
  let app: INestApplication;
  let passwordHash: string;
  let sessions: Array<{
    id: string;
    userId: string;
    refreshToken: string;
    status: string;
    activeTenantId: string | null;
  }>;

  const tenant = {
    id: tenantId,
    name: "Loja Centro",
    slug: "loja-centro",
    active: true,
  };

  const secondTenant = {
    id: secondTenantId,
    name: "Loja Filial",
    slug: "loja-filial",
    active: true,
  };

  const user = {
    id: userId,
    tenantId,
    role: UserRole.ADMIN,
    name: "Admin Centro",
    email: "admin@centro.local",
    passwordHash: "",
    status: AccessUserStatus.ACTIVE,
    isMaster: false,
    tenant,
    storeAssignments: [
      {
        tenantId: secondTenantId,
        status: AccessProfileStatus.ACTIVE,
        canManageStoreAccess: true,
        tenant: secondTenant,
        profile: {
          permissions: [
            { permission: { key: "orders.view" } },
            { permission: { key: "access.users.manage" } },
          ],
        },
      },
    ],
  };

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  const sessionTokenMock = {
    create: vi.fn(),
    assertActive: vi.fn(),
    revoke: vi.fn(),
    updateActiveStore: vi.fn(),
  };

  const passwordResetMock = {
    request: vi.fn(),
    confirm: vi.fn(),
  };

  const accessAuditMock = {
    record: vi.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    passwordHash = await hash("admin123", 10);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SessionTokenService)
      .useValue(sessionTokenMock)
      .overrideProvider(PasswordResetService)
      .useValue(passwordResetMock)
      .overrideProvider(AccessAuditService)
      .useValue(accessAuditMock)
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
    sessions = [];
    user.passwordHash = passwordHash;
    user.status = AccessUserStatus.ACTIVE;
    setupPrismaMock();
    setupSupportMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("logs in a multi-store user and returns normalized session scope", async () => {
    const response = await login();

    expect(response.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      activeStoreId: tenantId,
      permissions: ["orders.view", "access.users.manage"],
      allowedStores: [
        expect.objectContaining({ id: tenantId, slug: "loja-centro" }),
        expect.objectContaining({ id: secondTenantId, slug: "loja-filial" }),
      ],
      user: expect.objectContaining({
        id: userId,
        tenantId,
        activeStoreId: tenantId,
        allowedStoreIds: [tenantId, secondTenantId],
        manageableStoreIds: [secondTenantId],
      }),
    });
    expect(sessionTokenMock.create).toHaveBeenCalledOnce();
    expect(accessAuditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: userId,
        eventType: "LOGIN_SUCCESS",
        result: "SUCCESS",
      })
    );
  });

  it("rejects invalid credentials and records a failed login audit event", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@centro.local", password: "wrong-pass" })
      .expect(401);

    expect(accessAuditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LOGIN_FAILURE",
        result: "FAILED",
        reason: "Invalid credentials",
        metadata: { login: "admin@centro.local" },
      })
    );
  });

  it("refreshes, switches active store and logs out the current session", async () => {
    const loginResponse = await login();
    const { accessToken, refreshToken } = loginResponse.body;

    const refreshed = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(201);

    expect(refreshed.body).toMatchObject({
      refreshToken,
      activeStoreId: tenantId,
      permissions: ["orders.view", "access.users.manage"],
    });

    const switched = await request(app.getHttpServer())
      .patch("/api/admin/session/store")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ storeId: secondTenantId, refreshToken })
      .expect(200);

    expect(switched.body).toMatchObject({
      refreshToken,
      activeStoreId: secondTenantId,
      user: expect.objectContaining({
        tenantId: secondTenantId,
        activeStoreId: secondTenantId,
      }),
    });
    expect(sessions[0].activeTenantId).toBe(secondTenantId);

    await request(app.getHttpServer()).post("/api/auth/logout").send({ refreshToken }).expect(204);

    expect(sessions[0].status).toBe("REVOKED");
    await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(401);
  });

  it("accepts password reset requests and confirms a valid reset token", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/password-reset/request")
      .send({ login: "admin@centro.local" })
      .expect(202);

    expect(passwordResetMock.request).toHaveBeenCalledWith("admin@centro.local");

    await request(app.getHttpServer())
      .post("/api/auth/password-reset/confirm")
      .send({ token: "reset-token", newPassword: "nova-senha-123" })
      .expect(204);

    expect(passwordResetMock.confirm).toHaveBeenCalledWith("reset-token", "nova-senha-123");
    expect(accessAuditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PASSWORD_CHANGED", result: "SUCCESS" })
    );
  });

  async function login() {
    return request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@centro.local", password: "admin123" })
      .expect(201);
  }

  function setupPrismaMock(): void {
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email && where.email !== user.email) {
          return null;
        }

        if (where.id && where.id !== user.id) {
          return null;
        }

        return user;
      }
    );
    prismaMock.user.update.mockImplementation(
      ({ data }: { data: Partial<typeof user> & { passwordHash?: string } }) => {
        Object.assign(user, data);
        return user;
      }
    );
  }

  function setupSupportMocks(): void {
    sessionTokenMock.create.mockImplementation(
      (createdUserId: string, refreshToken: string, activeTenantId?: string | null) => {
        const session = {
          id: `session-${sessions.length + 1}`,
          userId: createdUserId,
          refreshToken,
          activeTenantId: activeTenantId ?? null,
          status: "ACTIVE",
        };
        sessions.push(session);
        return session;
      }
    );
    sessionTokenMock.assertActive.mockImplementation(
      (sessionUserId: string, refreshToken: string) => {
        const session = sessions.find(
          (candidate) =>
            candidate.userId === sessionUserId &&
            candidate.refreshToken === refreshToken &&
            candidate.status === "ACTIVE"
        );

        if (!session) {
          throw new UnauthorizedException("Refresh token invalid, revoked or expired");
        }

        return session;
      }
    );
    sessionTokenMock.revoke.mockImplementation((sessionUserId: string, refreshToken: string) => {
      const session = sessionTokenMock.assertActive(sessionUserId, refreshToken);
      session.status = "REVOKED";
    });
    sessionTokenMock.updateActiveStore.mockImplementation(
      (sessionUserId: string, refreshToken: string, activeTenantId: string) => {
        const session = sessionTokenMock.assertActive(sessionUserId, refreshToken);
        session.activeTenantId = activeTenantId;
        return session;
      }
    );
    passwordResetMock.request.mockResolvedValue({
      token: "reset-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    passwordResetMock.confirm.mockResolvedValue(undefined);
    accessAuditMock.record.mockResolvedValue(undefined);
  }
});
