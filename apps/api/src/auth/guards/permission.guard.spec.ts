import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PermissionGuard } from "./permission.guard";
import { RequirePermission } from "./require-permission.decorator";

class ProtectedController {
  @RequirePermission("access.users.manage")
  handler() {
    return null;
  }
}

describe("PermissionGuard", () => {
  const controller = new ProtectedController();
  const handler = controller.handler;
  const guard = new PermissionGuard();

  it("allows operators only when the required permission is present", () => {
    expect(() => guard.canActivate(contextWith(["access.users.manage"]))).not.toThrow();
    expect(() => guard.canActivate(contextWith(["orders.view"]))).toThrow(ForbiddenException);
  });

  it("keeps owner and admin roles compatible with legacy full access", () => {
    expect(() => guard.canActivate(contextWith([], UserRole.OWNER))).not.toThrow();
    expect(() => guard.canActivate(contextWith([], UserRole.ADMIN))).not.toThrow();
  });

  it("rejects platform administrators on store-scoped permission checks", () => {
    expect(() =>
      guard.canActivate(
        contextWith([], UserRole.ADMIN, {
          isMaster: true,
          isPlatformAdmin: true,
        })
      )
    ).toThrow(ForbiddenException);
  });

  function contextWith(
    permissions: string[],
    role: UserRole = UserRole.OPERATOR,
    overrides: Record<string, unknown> = {}
  ) {
    return {
      getHandler: () => handler,
      getClass: () => ProtectedController,
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          user: {
            role,
            isMaster: false,
            isPlatformAdmin: false,
            permissions,
            ...overrides,
          },
        }),
      }),
    } as unknown as ExecutionContext;
  }
});
