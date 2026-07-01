import { BadRequestException } from "@nestjs/common";
import { formatLocalDate, localDayEnd, localDayStart } from "./sales-report.types";

export interface ManagementReportQuery {
  start?: string;
  end?: string;
}

export interface ParsedManagementReportQuery {
  start: string;
  end: string;
  periodStart: Date;
  periodEnd: Date;
}

export function parseManagementReportQuery(
  query: ManagementReportQuery
): ParsedManagementReportQuery {
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

  return { start, end, periodStart, periodEnd };
}
