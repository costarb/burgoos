import { BadRequestException } from "@nestjs/common";
import { OrderStatus, PaymentInstitution, PaymentMethod } from "@prisma/client";

const paymentInstitutions = Object.values(PaymentInstitution);
const paymentMethods = Object.values(PaymentMethod);
const orderStatuses = Object.values(OrderStatus);

export interface SalesReportQuery {
  start?: string;
  end?: string;
  paymentInstitution?: string;
  paymentMethod?: string;
  orderPlatformId?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

export interface ParsedSalesReportQuery {
  start: string;
  end: string;
  periodStart: Date;
  periodEnd: Date;
  paymentInstitution?: PaymentInstitution;
  paymentMethod?: PaymentMethod;
  orderPlatformId?: string;
  status?: OrderStatus;
  page: number;
  pageSize: number;
}

export function parseSalesReportQuery(query: SalesReportQuery): ParsedSalesReportQuery {
  const now = new Date();
  const start = query.start ?? formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = query.end ?? formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const periodStart = localDayStart(start);
  const periodEnd = localDayEnd(end);

  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    throw new BadRequestException("Periodo invalido");
  }

  if (periodStart > periodEnd) {
    throw new BadRequestException("Data inicial deve ser anterior ou igual a data final");
  }

  const page = parsePositiveInteger(query.page, 1, "page");
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 50, "pageSize"), 100);

  return {
    start,
    end,
    periodStart,
    periodEnd,
    paymentInstitution: parseEnum(
      query.paymentInstitution,
      paymentInstitutions,
      "paymentInstitution"
    ),
    paymentMethod: parseEnum(query.paymentMethod, paymentMethods, "paymentMethod"),
    orderPlatformId: query.orderPlatformId || undefined,
    status: parseEnum(query.status, orderStatuses, "status"),
    page,
    pageSize,
  };
}

export function localDayStart(date: string): Date {
  const [year, month, day] = parseDateParts(date);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function localDayEnd(date: string): Date {
  const [year, month, day] = parseDateParts(date);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateParts(date: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return [Number.NaN, Number.NaN, Number.NaN];
  }

  const [year, month, day] = date.split("-").map(Number);
  return [year, month, day];
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: T[],
  fieldName: string
): T | undefined {
  if (!value) {
    return undefined;
  }

  if (!allowed.includes(value as T)) {
    throw new BadRequestException(`${fieldName} invalido`);
  }

  return value as T;
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
