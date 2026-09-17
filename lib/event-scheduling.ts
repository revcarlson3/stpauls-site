export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export function buildRecurringDates(start: Date, recurrence: {
  frequency: RecurrenceFrequency;
  interval: number;
  endMode: "DATE" | "OCCURRENCES";
  endDate?: string;
  occurrences?: number;
}) {
  const dates = [new Date(start)];
  const limit = recurrence.endMode === "OCCURRENCES" ? Number(recurrence.occurrences) : 365;
  const lastDate = recurrence.endMode === "DATE" && recurrence.endDate ? new Date(recurrence.endDate) : null;
  while (dates.length < limit) {
    const next = new Date(dates[dates.length - 1]);
    if (recurrence.frequency === "DAILY") next.setDate(next.getDate() + recurrence.interval);
    if (recurrence.frequency === "WEEKLY") next.setDate(next.getDate() + (7 * recurrence.interval));
    if (recurrence.frequency === "MONTHLY") next.setMonth(next.getMonth() + recurrence.interval);
    if (recurrence.frequency === "YEARLY") next.setFullYear(next.getFullYear() + recurrence.interval);
    if (lastDate && next > lastDate) break;
    dates.push(next);
  }
  return dates;
}

export function selectRotationAssignments(entryIds: string[], nextPosition: number, batchSize: number) {
  if (!entryIds.length) return { selectedIds: [], nextPosition };
  const size = Math.min(batchSize, entryIds.length);
  const selectedIds = entryIds.slice(nextPosition, nextPosition + size)
    .concat(nextPosition + size > entryIds.length ? entryIds.slice(0, (nextPosition + size) % entryIds.length) : []);
  return { selectedIds, nextPosition: (nextPosition + selectedIds.length) % entryIds.length };
}
