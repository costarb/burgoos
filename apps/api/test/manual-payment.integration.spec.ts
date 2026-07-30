import { ForbiddenException } from "@nestjs/common";
import { PaymentInstitution, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { ManualPaymentService } from "../src/payments/manual/manual-payment.service";

function permissionContext(permissions: string[]) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { "x-required-permission": "payments.confirm-manual" },
        user: {
          id: "user-a",
          tenantId: "tenant-a",
          role: UserRole.OPERATOR,
          permissions,
        },
      }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as never;
}

describe("manual payment permission and tenant integration", () => {
  it("requires explicit manual confirmation permission for an attendant", () => {
    const guard = new PermissionGuard();
    expect(() => guard.canActivate(permissionContext([]))).toThrow(ForbiddenException);
    expect(guard.canActivate(permissionContext(["payments.confirm-manual"]))).toBe(true);
  });

  it("lists enabled payment institutions only from the active tenant", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const findMany = vi.fn().mockResolvedValue([{
      paymentInstitution: PaymentInstitution.PAGBANK,
      name: "PagBank",
    }]);
    const service = new ManualPaymentService({
      paymentInstitutionConfiguration: { createMany, findMany },
    } as never);

    const result = await service.options("tenant-a");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-a", active: true }),
    }));
    expect(result[0]?.institution).toBe(PaymentInstitution.PAGBANK);
  });
});
