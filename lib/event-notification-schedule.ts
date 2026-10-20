const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidNotificationTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function isWithinQuietHours(date: Date, timeZone: string, start: string, end: string) {
  if (!isValidNotificationTime(start) || !isValidNotificationTime(end)) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const current = hour * 60 + minute;
  const quietStart = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const quietEnd = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  if (quietStart === quietEnd) return true;
  return quietStart < quietEnd
    ? current >= quietStart && current < quietEnd
    : current >= quietStart || current < quietEnd;
}
