import { McpToolCallResult } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createMcpFakePrisma } from "../../../../test/support/mcp-fake-prisma";
import { McpCallRetentionService } from "./mcp-call-retention.service";

function createService(options: { consumes?: boolean; batchSize?: number } = {}) {
  const prisma = createMcpFakePrisma();
  const values: Record<string, number> = {
    MCP_TOOL_CALL_RETENTION_DAYS: 90,
    RETENTION_BATCH_SIZE: options.batchSize ?? 250,
    RETENTION_DEADLINE_MS: 5_000,
  };
  const service = new McpCallRetentionService(
    prisma as never,
    { consumesBackgroundJobs: options.consumes ?? true } as never,
    { get: (key: string) => values[key] } as never
  );
  return { prisma, service };
}

function seedCall(prisma: ReturnType<typeof createMcpFakePrisma>, occurredAt: Date) {
  prisma.state.calls.push({
    id: `call-${prisma.state.calls.length}`,
    tenantId: "tenant-1",
    tokenId: null,
    method: "tools/call",
    target: "dre",
    arguments: null,
    result: McpToolCallResult.SUCCESS,
    errorCode: null,
    durationMs: 10,
    occurredAt,
  });
}

describe("McpCallRetentionService", () => {
  const now = new Date("2026-10-01T03:00:00.000Z");

  it("deletes only calls older than 90 days, in batches", async () => {
    const { prisma, service } = createService({ batchSize: 2 });
    for (let index = 0; index < 5; index += 1) seedCall(prisma, new Date("2026-06-01T00:00:00Z"));
    seedCall(prisma, new Date("2026-07-10T00:00:00Z"));

    const deleted = await service.purge(now);

    expect(deleted).toBe(5);
    expect(prisma.state.calls).toHaveLength(1);
    expect(prisma.state.calls[0].occurredAt).toEqual(new Date("2026-07-10T00:00:00Z"));
  });

  it("runs the schedule only on roles that consume background work", async () => {
    const api = createService({ consumes: false });
    seedCall(api.prisma, new Date("2026-01-01T00:00:00Z"));
    expect(await api.service.scheduledPurge()).toBe(0);
    expect(api.prisma.state.calls).toHaveLength(1);

    const worker = createService({ consumes: true });
    seedCall(worker.prisma, new Date("2026-01-01T00:00:00Z"));
    expect(await worker.service.scheduledPurge()).toBe(1);
  });
});
