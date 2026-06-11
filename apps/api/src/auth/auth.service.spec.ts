import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AccessAuditResult, AccessProfileStatus, AccessUserStatus, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessAuditService } from "../management/access/access-audit.service";
import { AuthService } from "../platform/auth/auth.service";

const tenant = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Loja Centro",
  slug: "loja-centro",
  active: true,
};

const secondTenant = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Loja Filial",
  slug: "loja-filial",
  active: true,
};

describe("AuthService", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const jwt = new JwtService();
  const sessionTokens = {
    create: vi.fn(),
    assertActive: vi.fn(),
    revoke: vi.fn(),
    updateActiveStore: vi.fn(),
  };
  const passwordReset = {
    request: vi.fn(),
    confirm: vi.fn(),
  };
  const audit = {
    record: vi.fn(),
  };

  let service: AuthService;
  let passwordHash: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    passwordHash = await hash("admin123", 10);
    service = new AuthService(
      prisma as never,
      jwt,
      sessionTokens as never,
      passwordReset as never,
      audit as unknown as AccessAuditService
    );
  });

  it("validates credentials and creates a scoped session", async () => {
    prisma.user.findUnique.mockResolvedValue(toUser());
    prisma.user.update.mockResolvedValue(toUser());
    sessionTokens.create.mockResolvedValue({ id: "session-1" });

    const result = await service.login({ email: "admin@centro.local", password: "admin123" });

    expect(result.user).toMatchObject({
      id: "user-1",
      activeStoreId: tenant.id,
      allowedStoreIds: [tenant.id, secondTenant.id],
      manageableStoreIds: [secondTenant.id],
      permissions: ["orders.view"],
    });
    expect(result.allowedStores).toEqual([
      expect.objectContaining({ id: tenant.id }),
      expect.objectContaining({ id: secondTenant.id }),
    ]);
    expect(sessionTokens.create).toHaveBeenCalledWith("user-1", result.refreshToken, tenant.id);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        result: AccessAuditResult.SUCCESS,
      })
    );
  });

  it("rejects invalid credentials and inactive users", async () => {
    prisma.user.findUnique.mockResolvedValue(toUser());

    await expect(
      service.login({ email: "admin@centro.local", password: "wrong-pass" })
    ).rejects.toThrow(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        result: AccessAuditResult.FAILED,
        reason: "Invalid credentials",
      })
    );

    prisma.user.findUnique.mockResolvedValue(toUser({ status: AccessUserStatus.INACTIVE }));

    await expect(
      service.login({ email: "admin@centro.local", password: "admin123" })
    ).rejects.toThrow(UnauthorizedException);
  });

  it("refreshes only active refresh tokens", async () => {
    const user = toUser();
    prisma.user.findUnique.mockResolvedValue(user);
    sessionTokens.assertActive.mockResolvedValue({ id: "session-1" });
    const refreshToken = await jwt.signAsync(
      {
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
        activeStoreId: secondTenant.id,
      },
      { secret: "test-refresh-secret" }
    );

    const refreshed = await service.refresh(refreshToken);

    expect(refreshed.activeStoreId).toBe(secondTenant.id);
    expect(sessionTokens.assertActive).toHaveBeenCalledWith(user.id, refreshToken);

    sessionTokens.assertActive.mockRejectedValueOnce(new UnauthorizedException("revoked"));

    await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it("allows switching only to stores authorized in the session", async () => {
    const actor = {
      id: "user-1",
      tenantId: tenant.id,
      role: UserRole.ADMIN,
      email: "admin@centro.local",
      name: "Admin Centro",
      allowedStoreIds: [tenant.id, secondTenant.id],
      activeStoreId: tenant.id,
    };

    const switched = await service.changeActiveStore(actor, secondTenant.id, "refresh-token");

    expect(switched.activeStoreId).toBe(secondTenant.id);
    expect(sessionTokens.updateActiveStore).toHaveBeenCalledWith(
      actor.id,
      "refresh-token",
      secondTenant.id
    );

    await expect(
      service.changeActiveStore(actor, "33333333-3333-4333-8333-333333333333")
    ).rejects.toThrow(ForbiddenException);
  });

  function toUser(overrides: Record<string, unknown> = {}) {
    return {
      id: "user-1",
      tenantId: tenant.id,
      role: UserRole.ADMIN,
      name: "Admin Centro",
      email: "admin@centro.local",
      passwordHash,
      status: AccessUserStatus.ACTIVE,
      isMaster: false,
      tenant,
      storeAssignments: [
        {
          tenantId: secondTenant.id,
          status: AccessProfileStatus.ACTIVE,
          canManageStoreAccess: true,
          tenant: secondTenant,
          profile: {
            permissions: [{ permission: { key: "orders.view" } }],
          },
        },
      ],
      ...overrides,
    };
  }
});
