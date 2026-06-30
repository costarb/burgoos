import { FinancialRecurrenceFrequency } from "@prisma/client";
import { PayableRecurrenceDto } from "../dto/payable.dto";

export interface PayableOccurrence {
  dueDate: Date;
  competenceDate?: Date | null;
  sequence: number;
}

export function buildPayableOccurrences(
  baseDueDate: Date,
  competenceDate: Date | null,
  recurrence?: PayableRecurrenceDto | null
): PayableOccurrence[] {
  if (!recurrence) {
    return [{ dueDate: baseDueDate, competenceDate, sequence: 1 }];
  }

  const startsOn = parseDate(recurrence.startsOn);
  const maxOccurrences = recurrence.occurrenceCount ?? 12;
  const endsOn = recurrence.endsOn ? parseDate(recurrence.endsOn) : null;
  const occurrences: PayableOccurrence[] = [];

  for (let sequence = 1; sequence <= maxOccurrences; sequence += 1) {
    const dueDate = addInterval(startsOn, recurrence.frequency, recurrence.interval * (sequence - 1));

    if (endsOn && dueDate.getTime() > endsOn.getTime()) {
      break;
    }

    occurrences.push({
      dueDate,
      competenceDate: competenceDate ? addInterval(competenceDate, recurrence.frequency, recurrence.interval * (sequence - 1)) : null,
      sequence,
    });
  }

  return occurrences.length > 0 ? occurrences : [{ dueDate: baseDueDate, competenceDate, sequence: 1 }];
}

function addInterval(date: Date, frequency: FinancialRecurrenceFrequency, amount: number): Date {
  const next = new Date(date);

  if (frequency === FinancialRecurrenceFrequency.WEEKLY) {
    next.setDate(next.getDate() + amount * 7);
    return next;
  }

  if (frequency === FinancialRecurrenceFrequency.YEARLY) {
    next.setFullYear(next.getFullYear() + amount);
    return next;
  }

  next.setMonth(next.getMonth() + amount);
  return next;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}
