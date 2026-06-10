import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AccessUserStatus, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthUser } from "../../../platform/auth/auth.types";
import { assertCanRemoveMaster, assertMasterAccess } from "./user-access-rules";

const regularUser: AuthUser = {
  id: "user-1",
  tenantId: "store-1",
  role: UserRole.OPERATOR,
  email: "user@example.com",
  name: "User",
};

describe("user access master rules", () => {
  it("allows master and platform admin actors", () => {
    expect(() => assertMasterAccess({ ...regularUser, isMaster: true })).not.toThrow();
    expect(() => assertMasterAccess({ ...regularUser, isPlatformAdmin: true })).not.toThrow();
  });

  it("rejects non-master actors", () => {
    expect(() => assertMasterAccess(regularUser)).toThrow(ForbiddenException);
  });

  it("blocks removing the last active master", async () => {
    await expect(
      assertCanRemoveMaster(
        { id: "master-1", isMaster: true },
        { status: AccessUserStatus.INACTIVE },
        async () => 1
      )
    ).rejects.toThrow(ConflictException);
  });

  it("allows master removal when another active master remains", async () => {
    const countActiveMasters = vi.fn(async () => 2);

    await expect(
      assertCanRemoveMaster(
        { id: "master-1", isMaster: true },
        { isMaster: false },
        countActiveMasters
      )
    ).resolves.toBeUndefined();
    expect(countActiveMasters).toHaveBeenCalledOnce();
  });

  it("does not check active master count when target is not losing master access", async () => {
    const countActiveMasters = vi.fn(async () => 1);

    await expect(
      assertCanRemoveMaster({ id: "master-1", isMaster: true }, {}, countActiveMasters)
    ).resolves.toBeUndefined();
    expect(countActiveMasters).not.toHaveBeenCalled();
  });
});
