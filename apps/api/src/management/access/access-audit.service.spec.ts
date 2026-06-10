import { ForbiddenException } from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AccessAuditService } from "./access-audit.service";

describe("AccessAuditService", () => {
  it("redacts secret metadata when recording audit events", async () => {
    const create = vi.fn(async (input) => input);
    const service = new AccessAuditService({
      accessAuditEvent: { create },
    } as never);

    await service.record({
      eventType: AccessAuditEventType.LOGIN_FAILURE,
      result: AccessAuditResult.FAILED,
      metadata: {
        login: "admin@burgoos.local",
        refreshToken: "secret",
        passwordHash: "hash",
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          login: "admin@burgoos.local",
          refreshToken: "[REDACTED]",
          passwordHash: "[REDACTED]",
        },
      }),
    });
  });

  it("scopes store-admin audit queries to manageable stores", async () => {
    const findMany = vi.fn(async () => []);
    const service = new AccessAuditService({
      accessAuditEvent: { findMany },
    } as never);

    await service.query({
      id: "admin-1",
      tenantId: "store-1",
      role: "ADMIN",
      email: "admin@example.com",
      name: "Admin",
      manageableStoreIds: ["store-1"],
    } as never);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: { in: ["store-1"] },
        }),
      })
    );
  });

  it("rejects store-admin audit queries outside manageable scope", async () => {
    const service = new AccessAuditService({
      accessAuditEvent: { findMany: vi.fn() },
    } as never);

    await expect(
      service.query(
        {
          id: "admin-1",
          tenantId: "store-1",
          role: "ADMIN",
          email: "admin@example.com",
          name: "Admin",
          manageableStoreIds: ["store-1"],
        } as never,
        { storeId: "store-2" }
      )
    ).rejects.toThrow(ForbiddenException);
  });
});
