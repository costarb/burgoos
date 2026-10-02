import { BadRequestException } from "@nestjs/common";
import { formatLocalDate, localDayEnd, localDayStart } from "./sales-report.types";

const COMPETENCE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface DreCompetence {
  /** `AAAA-MM`. */
  competence: string;
  /** First and last business day of the month (`AAAA-MM-DD`). */
  firstDay: string;
  lastDay: string;
  /** Sales window: the whole month in the store's business time zone. */
  salesStart: Date;
  salesEnd: Date;
  /**
   * Expense window, with the same local-date convention the payables screen uses for the
   * competence filter: [first day, first day of next month).
   */
  expenseStart: Date;
  expenseEnd: Date;
}

export function isCompetence(value: unknown): value is string {
  return typeof value === "string" && COMPETENCE_PATTERN.test(value);
}

export function currentCompetence(now = new Date()): string {
  return formatLocalDate(now).slice(0, 7);
}

/** Validates `AAAA-MM` (defaults to the current business month) and computes its windows. */
export function parseCompetence(value: string | undefined, now = new Date()): DreCompetence {
  const competence = value ?? currentCompetence(now);
  const match = COMPETENCE_PATTERN.exec(competence);
  if (!match) throw new BadRequestException("Competencia invalida. Use o formato AAAA-MM.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDay = `${competence}-01`;
  const lastDay = `${competence}-${String(lastDayOfMonth).padStart(2, "0")}`;
  return {
    competence,
    firstDay,
    lastDay,
    salesStart: localDayStart(firstDay),
    salesEnd: localDayEnd(lastDay),
    expenseStart: new Date(year, month - 1, 1),
    expenseEnd: new Date(year, month, 1),
  };
}

/** Legacy `start=AAAA-MM-DD` links map to their month. */
export function competenceFromDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 7) : undefined;
}
