import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { McpRequestContext, McpToolError } from "./mcp-context";
import { McpToolRunner } from "./mcp-tool-runner";

const context: McpRequestContext = {
  tenantId: "tenant-1",
  tokenId: "token-1",
  enabledAreas: [],
  storeName: "Loja",
  storeSlug: "loja",
};
const target = { method: "tools/call" as const, target: "dre", args: { inicio: "2026-09-01" } };

function createRunner(options: { admit?: boolean; timeoutMs?: number } = {}) {
  const callLog = { record: vi.fn(async () => undefined) };
  const runner = new McpToolRunner(
    { canAdmit: () => options.admit ?? true } as never,
    callLog as never,
    { get: () => options.timeoutMs ?? 1_000 } as never
  );
  return { runner, callLog };
}

describe("McpToolRunner", () => {
  it("returns the value and logs a successful call", async () => {
    const { runner, callLog } = createRunner();

    const outcome = await runner.run(context, target, async () => ({ ok: 1 }));

    expect(outcome).toEqual({ ok: true, value: { ok: 1 } });
    expect(callLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        tokenId: "token-1",
        method: "tools/call",
        target: "dre",
        arguments: { inicio: "2026-09-01" },
        result: "SUCCESS",
        errorCode: null,
      })
    );
  });

  it("keeps business error codes and messages", async () => {
    const { runner, callLog } = createRunner();

    const outcome = await runner.run(context, target, async () => {
      throw new McpToolError("PERIOD_TOO_LONG", "O periodo maximo por consulta e de 92 dias.");
    });

    expect(outcome).toEqual({
      ok: false,
      code: "PERIOD_TOO_LONG",
      message: "O periodo maximo por consulta e de 92 dias.",
    });
    expect(callLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: "ERROR", errorCode: "PERIOD_TOO_LONG" })
    );
  });

  it("maps service validation errors to period codes", async () => {
    const { runner } = createRunner();
    const tooLong = await runner.run(context, target, async () => {
      throw new BadRequestException("Relatorios interativos aceitam no maximo 92 dias.");
    });
    const invalid = await runner.run(context, target, async () => {
      throw new BadRequestException("Periodo invalido");
    });
    expect(tooLong).toMatchObject({ ok: false, code: "PERIOD_TOO_LONG" });
    expect(invalid).toMatchObject({ ok: false, code: "INVALID_PERIOD" });
  });

  it("times out slow handlers", async () => {
    const { runner } = createRunner({ timeoutMs: 10 });
    const outcome = await runner.run(
      context,
      target,
      () => new Promise((resolve) => setTimeout(resolve, 200))
    );
    expect(outcome).toMatchObject({ ok: false, code: "TIMEOUT" });
  });

  it("refuses work under memory pressure without running the handler", async () => {
    const { runner } = createRunner({ admit: false });
    const handler = vi.fn(async () => ({}));
    const outcome = await runner.run(context, target, handler);
    expect(outcome).toMatchObject({ ok: false, code: "MEMORY_PRESSURE" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("hides internal error details", async () => {
    const { runner } = createRunner();
    const outcome = await runner.run(context, target, async () => {
      throw new Error("connection to postgres://user:secret@db failed");
    });
    expect(outcome).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Nao foi possivel concluir a consulta.",
    });
  });
});
