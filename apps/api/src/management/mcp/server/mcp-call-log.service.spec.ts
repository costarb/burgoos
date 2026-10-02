import { McpToolCallResult, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createMcpFakePrisma } from "../../../../test/support/mcp-fake-prisma";
import { McpCallLogService, sanitizeArguments } from "./mcp-call-log.service";

describe("McpCallLogService", () => {
  it("records calls with bounded method, target and arguments", async () => {
    const prisma = createMcpFakePrisma();
    const service = new McpCallLogService(prisma as never);

    await service.record({
      tenantId: "tenant-1",
      tokenId: "token-1",
      method: "tools/call",
      target: "x".repeat(120),
      arguments: { inicio: "2026-09-01" },
      result: McpToolCallResult.SUCCESS,
      durationMs: 12.6,
    });

    expect(prisma.state.calls[0]).toMatchObject({
      tenantId: "tenant-1",
      tokenId: "token-1",
      target: "x".repeat(80),
      arguments: { inicio: "2026-09-01" },
      durationMs: 13,
      errorCode: null,
    });
  });

  it("truncates large arguments and drops empty ones", () => {
    const large = sanitizeArguments({ texto: "a".repeat(5_000) }) as { truncado: boolean; previa: string };
    expect(large.truncado).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(large))).toBeLessThanOrEqual(1024);
    expect(sanitizeArguments({})).toBe(Prisma.DbNull);
    expect(sanitizeArguments(undefined)).toBe(Prisma.DbNull);
    expect(sanitizeArguments(["a"])).toBe(Prisma.DbNull);
  });

  it("never fails the caller when the log cannot be written", async () => {
    const prisma = { mcpToolCall: { create: vi.fn(async () => Promise.reject(new Error("db down"))) } };
    const service = new McpCallLogService(prisma as never);

    await expect(
      service.record({
        tenantId: "tenant-1",
        tokenId: null,
        method: "tools/call",
        result: McpToolCallResult.ERROR,
        durationMs: 1,
      })
    ).resolves.toBeUndefined();
  });

  it("updates lastUsedAt at most once per minute", async () => {
    const prisma = createMcpFakePrisma();
    prisma.state.tokens.push({
      id: "token-1",
      tenantId: "tenant-1",
      name: "Token",
      tokenHash: "hash",
      tokenPrefix: "rrf_mcp_abc",
      expiresAt: null,
      revokedAt: null,
      revokedByUserId: null,
      lastUsedAt: null,
      createdByUserId: null,
      createdAt: new Date(),
    });
    const service = new McpCallLogService(prisma as never);
    const first = new Date("2026-10-01T12:00:00Z");

    await service.touchToken("token-1", first);
    await service.touchToken("token-1", new Date("2026-10-01T12:00:30Z"));
    expect(prisma.state.tokens[0].lastUsedAt).toEqual(first);

    const later = new Date("2026-10-01T12:01:30Z");
    await service.touchToken("token-1", later);
    expect(prisma.state.tokens[0].lastUsedAt).toEqual(later);
  });
});
