import { ConflictException } from "@nestjs/common";
import {
  AccessAuditEventType,
  AccessAuditResult,
  AccessProfileScope,
  UserRole,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthUser } from "../../../platform/auth/auth.types";
import { AccessProfilesService } from "./access-profiles.service";

const masterActor: AuthUser = {
  id: "master-1",
  tenantId: "store-1",
  role: UserRole.ADMIN,
  email: "master@example.com",
  name: "Master",
  isMaster: true,
};

const storeAdminActor: AuthUser = {
  id: "admin-1",
  tenantId: "store-1",
  role: UserRole.ADMIN,
  email: "admin@example.com",
  name: "Store Admin",
  manageableStoreIds: ["store-1"],
};

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    accessProfile: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
    },
    accessProfilePermission: {
      deleteMany: vi.fn(),
    },
    permission: {
      upsert: vi.fn(async (input) => input),
    },
    $transaction: vi.fn(async (input) => {
      if (typeof input === "function") {
        return input({
          accessProfile: prisma.accessProfile,
          accessProfilePermission: prisma.accessProfilePermission,
        });
      }

      return Promise.all(input);
    }),
    ...overrides,
  };

  const audit = {
    record: vi.fn(async () => undefined),
  };

  return {
    prisma,
    audit,
    service: new AccessProfilesService(prisma as never, audit as never),
  };
}

describe("AccessProfilesService", () => {
  it("rejects duplicated profile names in the same scope", async () => {
    const { prisma, service } = createService();
    prisma.accessProfile.findFirst.mockResolvedValueOnce({ id: "existing-profile" } as never);

    await expect(
      service.create(masterActor, {
        name: "Financeiro",
        scope: AccessProfileScope.GLOBAL,
        permissionKeys: ["finance.view"],
      })
    ).rejects.toThrow(ConflictException);
  });

  it("allows store admins to create profiles only inside their manageable stores", async () => {
    const { prisma, service } = createService();
    prisma.accessProfile.create.mockResolvedValueOnce({
      id: "profile-1",
      tenantId: "store-1",
      permissions: [],
    });

    await expect(
      service.create(storeAdminActor, {
        name: "Operacao local",
        scope: AccessProfileScope.STORE,
        storeId: "store-1",
        permissionKeys: ["orders.view"],
      })
    ).resolves.toMatchObject({ id: "profile-1", tenantId: "store-1" });

    await expect(
      service.create(storeAdminActor, {
        name: "Operacao outra loja",
        scope: AccessProfileScope.STORE,
        storeId: "store-2",
        permissionKeys: ["orders.view"],
      })
    ).rejects.toThrow(ConflictException);
  });

  it("upserts only requested permission catalog entries", async () => {
    const { prisma, service } = createService();

    await service.ensurePermissionCatalog(["orders.view", "finance.view"]);

    expect(prisma.permission.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.permission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "orders.view" } })
    );
    expect(prisma.permission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "finance.view" } })
    );
  });

  it("copies permission grants and records an audit event when duplicating profiles", async () => {
    const { audit, prisma, service } = createService();
    prisma.accessProfile.findFirst
      .mockResolvedValueOnce({
        id: "profile-source",
        tenantId: "store-1",
        description: "Perfil base",
        scope: AccessProfileScope.STORE,
        permissions: [
          { permission: { key: "orders.view" } },
          { permission: { key: "finance.view" } },
        ],
      } as never)
      .mockResolvedValueOnce(null);
    prisma.accessProfile.create.mockResolvedValueOnce({
      id: "profile-copy",
      tenantId: "store-1",
      permissions: [],
    });

    await expect(
      service.duplicate(storeAdminActor, "profile-source", "Copia local")
    ).resolves.toMatchObject({
      id: "profile-copy",
      tenantId: "store-1",
    });

    expect(prisma.accessProfile.create).toHaveBeenCalledWith(
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
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        eventType: AccessAuditEventType.PROFILE_CREATED,
        result: AccessAuditResult.SUCCESS,
        metadata: expect.objectContaining({
          duplicatedFromProfileId: "profile-source",
          profileId: "profile-copy",
        }),
      }),
      expect.anything()
    );
  });
});
