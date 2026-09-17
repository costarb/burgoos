import { describe, expect, it, vi } from "vitest";
import { IntegrationAuditService } from "./integration-audit.service";

function setup() {
  const prisma = { integrationAuditEvent: { create: vi.fn() } };
  const secrets = {
    redact: vi.fn((value: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          /secret|token|password|authorization|code|verifier|signature|document|bank|nsu|cpf|cnpj|iban|agency|account/i.test(
            key
          )
            ? "********"
            : item,
        ])
      )
    ),
  };
  return {
    service: new IntegrationAuditService(prisma as never, secrets as never),
    prisma,
    secrets,
  };
}

describe("IntegrationAuditService", () => {
  it("drops metadata keys outside the allowlist before persisting", async () => {
    const { service, prisma } = setup();
    await service.record({
      tenantId: "tenant-1",
      integrationId: "integration-1",
      action: "IFOOD_FINANCIAL_LINKED",
      outcome: "CREATED",
      metadata: {
        resourceId: "delivery-1",
        accessToken: "should-not-be-allowlisted",
        arbitraryField: "dropped",
      },
    });
    expect(prisma.integrationAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { resourceId: "delivery-1" },
        }),
      })
    );
  });

  it("redacts allowlisted keys that still look like secrets, tokens, documents or bank data", async () => {
    const { service, prisma } = setup();
    await service.record({
      tenantId: "tenant-1",
      integrationId: "integration-1",
      action: "IFOOD_FINANCIAL_READINESS_VALIDATED",
      outcome: "REQUIRES_ATTENTION",
      metadata: {
        outcomeCode: "SAFE_CODE",
      },
    });
    expect(prisma.integrationAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { outcomeCode: "********" },
        }),
      })
    );
  });

  it("never persists document, bank or NSU values even if the allowlist were widened", async () => {
    const { service, prisma, secrets } = setup();
    await service.record({
      tenantId: "tenant-1",
      integrationId: "integration-1",
      action: "IFOOD_FINANCIAL_RECONCILIATION_COMPLETED",
      outcome: "COMPLETED",
      metadata: { runId: "run-1" },
    });
    expect(secrets.redact).toHaveBeenCalled();
    const [[persisted]] = prisma.integrationAuditEvent.create.mock.calls;
    const serialized = JSON.stringify(persisted.data.metadata);
    expect(serialized).not.toMatch(/nsu|document|bank|cpf|cnpj/i);
  });
});
