import type { McpDataArea } from "@prisma/client";
import { z } from "zod";
import { MAX_INTERACTIVE_REPORT_DAYS } from "../../reports/sales-report.types";
import { McpRequestContext, McpToolError } from "../server/mcp-context";

export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
export const MAX_LIST_ITEMS = 50;

export type ToolOutput = Record<string, unknown>;

export interface McpToolDefinition {
  name: string;
  area: McpDataArea;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (context: McpRequestContext, args: Record<string, unknown>) => Promise<ToolOutput>;
}

export const dateArg = (description: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
    .optional()
    .describe(description);

export interface PeriodOutput {
  inicio: string;
  fim: string;
  fuso: string;
  padraoAplicado: boolean;
}

/**
 * Validates an optional `inicio`/`fim` pair, falling back to the given default range, and
 * enforces the interactive report limit with the error codes of the MCP contract.
 */
export function resolvePeriod(
  args: { inicio?: unknown; fim?: unknown },
  fallback: { start: string; end: string },
  maxDays = MAX_INTERACTIVE_REPORT_DAYS
): PeriodOutput {
  const inicio = typeof args.inicio === "string" ? args.inicio : undefined;
  const fim = typeof args.fim === "string" ? args.fim : undefined;
  const start = inicio ?? fallback.start;
  const end = fim ?? fallback.end;
  assertPeriod(start, end, maxDays);
  return {
    inicio: start,
    fim: end,
    fuso: BUSINESS_TIME_ZONE,
    padraoAplicado: inicio === undefined && fim === undefined,
  };
}

export function assertPeriod(start: string, end: string, maxDays = MAX_INTERACTIVE_REPORT_DAYS) {
  const startTime = calendarTime(start);
  const endTime = calendarTime(end);
  if (startTime === null || endTime === null || startTime > endTime) {
    throw new McpToolError(
      "INVALID_PERIOD",
      "Periodo invalido: a data inicial deve ser anterior ou igual a final, no formato AAAA-MM-DD."
    );
  }
  const days = Math.round((endTime - startTime) / 86_400_000) + 1;
  if (days > maxDays) {
    throw new McpToolError(
      "PERIOD_TOO_LONG",
      `O periodo maximo por consulta e de ${maxDays} dias. Divida a analise em periodos menores.`
    );
  }
}

function calendarTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return time;
}

/** Money as a number with two decimals (`"1234.5"` → `1234.5`). */
export function reais(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? 0));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

/** Fraction (0.1234) to percentage with one decimal (12.3). */
export function percentual(fraction: unknown): number {
  const parsed = typeof fraction === "number" ? fraction : Number(String(fraction ?? 0));
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 10 : 0;
}

/** Ratio of two money values as a percentage, 0 when the base is zero. */
export function ratio(part: unknown, total: unknown): number {
  const base = reais(total);
  return base === 0 ? 0 : percentual(reais(part) / base);
}

export function truncate<T>(items: T[], limit = MAX_LIST_ITEMS) {
  return { items: items.slice(0, limit), totalItens: items.length, truncado: items.length > limit };
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
