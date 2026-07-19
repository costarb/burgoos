/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { IntegrationAuditService } from "./integration-audit.service";

describe("IntegrationAuditService", () => {
  it.each(["CONNECTED", "REFRESHED", "SYNCED", "WEBHOOK_PROCESSED", "DISCONNECTED"])(
    "stores allowlisted metadata for %s without secrets",
    async (action) => {
      const create = vi.fn();
      const secrets: any = { redact: vi.fn((value) => value) };
      const service = new IntegrationAuditService(
        { integrationAuditEvent: { create } } as any,
        secrets
      );
      await service.record({
        tenantId: "tenant",
        integrationId: "integration",
        action,
        outcome: "SUCCESS",
        metadata: {
          providerUserId: "123",
          runId: "run",
          accessToken: "APP_USR-secret",
          arbitrary: "drop-me",
        },
      });
      const metadata = create.mock.calls[0][0].data.metadata;
      expect(metadata).toEqual({ providerUserId: "123", runId: "run" });
      expect(JSON.stringify(metadata)).not.toContain("secret");
      expect(metadata).not.toHaveProperty("arbitrary");
    }
  );
});
