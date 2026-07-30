import "reflect-metadata";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { REQUIRED_PERMISSION_KEY } from "../src/auth/guards/require-permission.decorator";
import { PaymentExceptionResolutionService } from "../src/payments/application/payment-exception-resolution.service";

describe("payment exception resolution", () => {
  it("requires payments.reconcile from non-manager operators", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_PERMISSION_KEY, ["payments.reconcile"], handler);
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          user: {
            role: UserRole.OPERATOR,
            permissions: ["payment-exceptions.view"],
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => new PermissionGuard().canActivate(context)).toThrow(ForbiddenException);
  });

  it("records actor, reason and immutable operational audit when resolved", async () => {
    const update = vi.fn().mockResolvedValue({ id: "exception-1", status: "RESOLVED" });
    const createEvent = vi.fn();
    const prisma = {
      paymentException: {
        findFirst: vi.fn().mockResolvedValue({
          id: "exception-1",
          tenantId: "tenant-1",
          status: "OPEN",
          chargeId: "charge-1",
          charge: { orderId: "order-1", serviceTabId: null },
        }),
      },
      $transaction: vi.fn((callback) => callback({
        paymentException: { update },
        orderOperationalEvent: { create: createEvent },
      })),
    };
    const service = new PaymentExceptionResolutionService(prisma as never);
    await service.finish({
      id: "manager-1",
      tenantId: "tenant-1",
      role: UserRole.ADMIN,
      email: "manager@example.com",
      name: "Gerente",
    }, "exception-1", "RESOLVED", "Conferido no extrato da adquirente");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        resolvedByUserId: "manager-1",
        resolution: "Conferido no extrato da adquirente",
      }),
    }));
    expect(createEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "manager-1",
        type: "PAYMENT_EXCEPTION_RESOLVED",
        chargeId: "charge-1",
      }),
    });
  });
});
