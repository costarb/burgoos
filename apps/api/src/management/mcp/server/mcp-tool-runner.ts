import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { McpToolCallResult } from "@prisma/client";
import { MemoryPressureService } from "../../../common/observability/memory-pressure.service";
import { McpCallLogService } from "./mcp-call-log.service";
import { McpErrorCode, McpRequestContext, McpToolError } from "./mcp-context";

export interface McpRunTarget {
  method: "tools/call" | "resources/read" | "prompts/get";
  target: string;
  args?: Record<string, unknown>;
}

export type McpRunOutcome<T> = { ok: true; value: T } | { ok: false; code: McpErrorCode; message: string };

const MESSAGES: Record<McpErrorCode, string> = {
  INVALID_PERIOD:
    "Periodo invalido: a data inicial deve ser anterior ou igual a final, no formato AAAA-MM-DD.",
  PERIOD_TOO_LONG:
    "O periodo maximo por consulta e de 92 dias. Divida a analise em periodos menores.",
  AREA_DISABLED: "Esta area de dados nao esta liberada para esta loja.",
  TIMEOUT: "A consulta demorou demais. Tente um periodo menor.",
  MEMORY_PRESSURE:
    "O sistema esta sob carga no momento. Aguarde alguns instantes ou use um periodo menor.",
  INTERNAL: "Nao foi possivel concluir a consulta.",
};

/**
 * Wraps every MCP handler: admission under memory pressure, timeout, mapping of errors to the
 * contract codes (never leaking internals) and the usage log.
 */
@Injectable()
export class McpToolRunner {
  private readonly logger = new Logger(McpToolRunner.name);
  private readonly timeoutMs: number;

  constructor(
    @Inject(MemoryPressureService) private readonly pressure: MemoryPressureService,
    @Inject(McpCallLogService) private readonly callLog: McpCallLogService,
    @Inject(ConfigService) config: ConfigService
  ) {
    this.timeoutMs = config.get<number>("MCP_TOOL_TIMEOUT_MS") ?? 20_000;
  }

  async run<T>(
    context: McpRequestContext,
    target: McpRunTarget,
    handler: () => Promise<T>
  ): Promise<McpRunOutcome<T>> {
    const startedAt = Date.now();
    let outcome: McpRunOutcome<T>;

    if (!this.pressure.canAdmit("NORMAL")) {
      outcome = failure("MEMORY_PRESSURE");
    } else {
      try {
        outcome = { ok: true, value: await this.withTimeout(handler()) };
      } catch (error) {
        outcome = this.toFailure(error, context, target);
      }
    }

    void this.callLog.record({
      tenantId: context.tenantId,
      tokenId: context.tokenId,
      method: target.method,
      target: target.target,
      arguments: target.args,
      result: outcome.ok ? McpToolCallResult.SUCCESS : McpToolCallResult.ERROR,
      errorCode: outcome.ok ? null : outcome.code,
      durationMs: Date.now() - startedAt,
    });

    this.logger.log(
      `mcp.call tenantId=${context.tenantId} tokenId=${context.tokenId} ${target.method} ${target.target} result=${
        outcome.ok ? "SUCCESS" : outcome.code
      } durationMs=${Date.now() - startedAt}`
    );
    return outcome;
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new McpToolError("TIMEOUT", MESSAGES.TIMEOUT)), this.timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  private toFailure<T>(
    error: unknown,
    context: McpRequestContext,
    target: McpRunTarget
  ): McpRunOutcome<T> {
    if (error instanceof McpToolError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof BadRequestException) {
      const message = error.message ?? "";
      return failure(/maximo/i.test(message) ? "PERIOD_TOO_LONG" : "INVALID_PERIOD");
    }
    this.logger.error(
      `mcp.call_failed tenantId=${context.tenantId} ${target.method} ${target.target}`,
      error instanceof Error ? error.stack : String(error)
    );
    return failure("INTERNAL");
  }
}

function failure<T>(code: McpErrorCode): McpRunOutcome<T> {
  return { ok: false, code, message: MESSAGES[code] };
}

export function mcpErrorMessage(code: McpErrorCode): string {
  return MESSAGES[code];
}
