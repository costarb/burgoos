import { BadRequestException } from "@nestjs/common";
import { assertInteractivePeriod, localDayEnd, localDayStart, rollingReportRange } from "./sales-report.types";

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

  return { start, end, periodStart, periodEnd };
}
