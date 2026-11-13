import { describe, expect, it, vi } from "vitest";
import { FiscalAuditService, sanitize } from "./fiscal-audit.service";

describe("FiscalAuditService", () => {
  it("redacts sensitive keys recursively but keeps ids", () => {
    expect(
      sanitize({
        documentId: "doc-1",
        accessToken: "abc",
        nested: { consumerDocument: "52998224725", xml: "<x/>", code: "778" },
        list: [{ password: "p" }],
      })
    ).toEqual({
      documentId: "doc-1",
      accessToken: "********",
      nested: { consumerDocument: "********", xml: "********", code: "778" },
      list: [{ password: "********" }],
    });
  });

  it("persists sanitized events with truncated code and message", async () => {
    const create = vi.fn().mockResolvedValue({});
    const service = new FiscalAuditService({ fiscalDocumentEvent: { create } } as never);

    await service.event({
      tenantId: "t1",
      documentId: "d1",
      type: "REJECTED",
      code: "x".repeat(60),
      message: "m".repeat(600),
      metadata: { refreshToken: "secret", attempt: 2 },
    });

    const data = create.mock.calls[0][0].data;
    expect(data.code).toHaveLength(40);
    expect(data.message).toHaveLength(500);
    expect(data.metadata).toEqual({ refreshToken: "********", attempt: 2 });
  });
});
