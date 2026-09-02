import { BadRequestException } from "@nestjs/common";
import { OrderStatus, PaymentInstitution, PaymentMethod } from "@prisma/client";

const paymentInstitutions = Object.values(PaymentInstitution);
const paymentMethods = Object.values(PaymentMethod);
const orderStatuses = Object.values(OrderStatus);
const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
export const MAX_INTERACTIVE_REPORT_DAYS = 92;
const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface SalesReportQuery {
  start?: string;
  end?: string;
  paymentInstitution?: string | string[];
  paymentMethod?: string | string[];
  orderPlatformId?: string | string[];
  status?: string | string[];
  page?: string;
  pageSize?: string;
}

export interface ParsedSalesReportQuery {
  start: string;
  end: string;
  periodStart: Date;
  periodEnd: Date;
  paymentInstitutions?: PaymentInstitution[];
  paymentMethods?: PaymentMethod[];
  orderPlatformIds?: string[];
  statuses?: OrderStatus[];
  /** Legacy singular fields kept for internal callers during migration. */
  paymentInstitution?: PaymentInstitution;
  paymentMethod?: PaymentMethod;
  orderPlatformId?: string;
  status?: OrderStatus;
  page: number;
  pageSize: number;
}

export function parseSalesReportQuery(query: SalesReportQuery): ParsedSalesReportQuery {
  const now = new Date();
  const defaultRange = rollingReportRange(now);
  const start = query.start ?? defaultRange.start;
  const end = query.end ?? defaultRange.end;
  const periodStart = localDayStart(start);
  const periodEnd = localDayEnd(end);

  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    throw new BadRequestException("Periodo invalido");
  }

  if (periodStart > periodEnd) {
    throw new BadRequestException("Data inicial deve ser anterior ou igual a data final");
  }

  assertInteractivePeriod(periodStart, periodEnd);

  const page = parsePositiveInteger(query.page, 1, "page");
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 50, "pageSize"), 100);

  return {
    start,
    end,
    periodStart,
    periodEnd,
    paymentInstitutions: parseEnums(
      query.paymentInstitution,
      paymentInstitutions,
      "paymentInstitution"
    ),
    paymentMethods: parseEnums(query.paymentMethod, paymentMethods, "paymentMethod"),
    orderPlatformIds: normalizeValues(query.orderPlatformId),
    statuses: parseEnums(query.status, orderStatuses, "status"),
    page,
    pageSize,
  };
}

export function assertInteractivePeriod(periodStart: Date, periodEnd: Date): void {
  const inclusiveDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;
  if (inclusiveDays > MAX_INTERACTIVE_REPORT_DAYS) {
    throw new BadRequestException(
      `Relatorios interativos aceitam no maximo ${MAX_INTERACTIVE_REPORT_DAYS} dias. Solicite uma exportacao para periodos maiores.`
    );
  }
}

export function rollingReportRange(date: Date, days = 31): { start: string; end: string } {
  const end = formatLocalDate(date);
  const startDate = new Date(`${end}T12:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
  return { start: startDate.toISOString().slice(0, 10), end };
}

export function businessMonthRange(date: Date): { start: string; end: string } {
  const [year, month] = formatLocalDate(date).split("-").map(Number);
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

export function localDayStart(date: string): Date {
  const [year, month, day] = parseDateParts(date);
  return zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0);
}

export function localDayEnd(date: string): Date {
  const [year, month, day] = parseDateParts(date);
  return zonedDateTimeToUtc(year, month, day, 23, 59, 59, 999);
}

export function formatLocalDate(date: Date): string {
  return businessDateFormatter.format(date);
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number
): Date {
  if (![year, month, day].every(Number.isFinite)) return new Date(Number.NaN);
  const intendedUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let candidate = intendedUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = businessDateTimeParts(new Date(candidate));
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      millisecond
    );
    candidate += intendedUtc - representedUtc;
  }
  return new Date(candidate);
}

function businessDateTimeParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return values as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

function parseDateParts(date: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return [Number.NaN, Number.NaN, Number.NaN];
  }

  const [year, month, day] = date.split("-").map(Number);
  return [year, month, day];
}

function parseEnums<T extends string>(
  value: string | string[] | undefined,
  allowed: T[],
  fieldName: string
): T[] {
  const values = normalizeValues(value);
  if (values.some((item) => !allowed.includes(item as T))) {
    throw new BadRequestException(`${fieldName} invalido`);
  }
  return values as T[];
}

function normalizeValues(value?: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function parsePositiveInteger(value: string | undefined, fallback: number, fieldName: string) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${fieldName} invalido`);
  }

  return parsed;
}
