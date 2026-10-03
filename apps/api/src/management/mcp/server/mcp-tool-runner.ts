import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { McpToolCallResult } from "@prisma/client";
import { MemoryPressureService } from "../../../common/observability/memory-pressure.service";
import { actionDeniedMessage, MCP_ACTIONS_PER_HOUR, McpActionGroup } from "../mcp-actions";
import { McpCallLogService } from "./mcp-call-log.service";
import { McpErrorCode, McpRequestContext, McpToolError } from "./mcp-context";

export interface McpRunTarget {
  method: "tools/call" | "resources/read" | "prompts/get";
  target: string;
  args?: Record<string, unknown>;
  /** Action group of a write tool (or of a read that only supports actions). */
  action?: { group: McpActionGroup; writes: boolean };
}

export type McpRunOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; code: McpErrorCode; message: string };

const MESSAGES: Record<McpErrorCode, string> = {
  INVALID_PERIOD:
    "Periodo invalido: a data inicial deve ser anterior ou igual a final, no formato AAAA-MM-DD.",
  PERIOD_TOO_LONG:
    "O periodo maximo por consulta e de 92 dias. Divida a analise em periodos menores.",
  INVALID_FILTER: "Filtro invalido. Revise os valores informados.",
  AREA_DISABLED: "Esta area de dados nao esta liberada para esta loja.",
  TIMEOUT: "A consulta demorou demais. Tente um periodo menor.",
  MEMORY_PRESSURE:
    "O sistema esta sob carga no momento. Aguarde alguns instantes ou use um periodo menor.",
  ACTION_NOT_ALLOWED: "Esta acao nao esta liberada para esta conexao.",
  ACTION_RATE_LIMITED: `Limite de ${MCP_ACTIONS_PER_HOUR} acoes por hora atingido para esta conexao. Tente novamente mais tarde.`,
  BUSINESS_RULE: "A operacao nao pode ser concluida.",
  NOT_FOUND: "Registro nao encontrado.",
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

    const blocked = target.action ? await this.actionBlock(context, target.action) : null;
    if (blocked) {
      outcome = blocked;
    } else if (!this.pressure.canAdmit("NORMAL")) {
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
      connectionId: context.connectionId ?? null,
      method: target.method,
      target: target.target,
      arguments: target.args,
      result: outcome.ok ? McpToolCallResult.SUCCESS : McpToolCallResult.ERROR,
      errorCode: outcome.ok ? null : outcome.code,
      durationMs: Date.now() - startedAt,
      isAction: target.action?.writes ?? false,
    });

    this.logger.log(
      `mcp.call tenantId=${context.tenantId} credential=${context.connectionId ?? context.tokenId} ${target.method} ${target.target} result=${
        outcome.ok ? "SUCCESS" : outcome.code
      } durationMs=${Date.now() - startedAt}`
    );
    return outcome;
  }

  /** Re-checks the action on every call and applies the per-connection hourly limit. */
  private async actionBlock(
    context: McpRequestContext,
    action: { group: McpActionGroup; writes: boolean }
  ): Promise<{ ok: false; code: McpErrorCode; message: string } | null> {
    const denied = actionDeniedMessage(context.actions, context.enabledAreas, action.group);
    if (denied) return { ok: false, code: "ACTION_NOT_ALLOWED", message: denied };
    if (action.writes && context.connectionId) {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      if ((await this.callLog.countActions(context.connectionId, since)) >= MCP_ACTIONS_PER_HOUR) {
        return { ok: false, code: "ACTION_RATE_LIMITED", message: MESSAGES.ACTION_RATE_LIMITED };
      }
    }
    return null;
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new McpToolError("TIMEOUT", MESSAGES.TIMEOUT)),
        this.timeoutMs
      );
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
    if (target.action) {
      // Write tools reuse the screens' services, whose messages are user-facing business rules.
      if (error instanceof NotFoundException)
        return { ok: false, code: "NOT_FOUND", message: error.message };
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        return { ok: false, code: "BUSINESS_RULE", message: error.message };
      }
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
