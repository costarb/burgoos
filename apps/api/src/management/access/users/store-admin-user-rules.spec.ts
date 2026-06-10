import { ForbiddenException } from "@nestjs/common";
import { AccessProfileStatus, UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AuthUser } from "../../../platform/auth/auth.types";
import {
  assertCanManageAssignments,
  assertCanManageTarget,
  manageableStoreIds,
} from "./store-admin-user-rules";

const storeAdmin: AuthUser = {
  id: "admin-1",
  tenantId: "store-1",
  role: UserRole.ADMIN,
  email: "admin@example.com",
  name: "Store Admin",
  manageableStoreIds: ["store-1"],
};

describe("store admin user rules", () => {
  it("returns local manageable store ids for store admins", () => {
    expect(manageableStoreIds(storeAdmin)).toEqual(["store-1"]);
  });

  it("does not constrain master actors by local manageable store ids", () => {
    expect(manageableStoreIds({ ...storeAdmin, isMaster: true })).toEqual([]);
  });

  it("allows assignments inside the admin store scope", () => {
    expect(() =>
      assertCanManageAssignments(storeAdmin, [
        {
          storeId: "store-1",
          profileId: "profile-1",
          canManageStoreAccess: false,
          status: AccessProfileStatus.ACTIVE,
        },
      ])
    ).not.toThrow();
  });

  it("rejects assignments outside the admin store scope", () => {
    expect(() =>
      assertCanManageAssignments(storeAdmin, [
        {
          storeId: "store-2",
          profileId: "profile-1",
          canManageStoreAccess: false,
          status: AccessProfileStatus.ACTIVE,
        },
      ])
    ).toThrow(ForbiddenException);
  });

  it("allows managing a non-master user assigned to the admin store", () => {
    expect(() =>
      assertCanManageTarget(storeAdmin, {
        isMaster: false,
        storeAssignments: [{ tenantId: "store-1" }],
      })
    ).not.toThrow();
  });

  it("rejects changing master users and users outside scope", () => {
    expect(() =>
      assertCanManageTarget(storeAdmin, {
        isMaster: true,
        storeAssignments: [{ tenantId: "store-1" }],
      })
    ).toThrow(ForbiddenException);

    expect(() =>
      assertCanManageTarget(storeAdmin, {
        isMaster: false,
        storeAssignments: [{ tenantId: "store-2" }],
      })
    ).toThrow(ForbiddenException);
  });
});
