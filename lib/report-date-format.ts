export function formatReportDate(value: Date | string | null | undefined, timeZone = "America/Chicago") {
  if (!value) return "—";
  const raw = value instanceof Date ? value.toISOString() : value;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return String(value);
  if (raw.length <= 10) return `${parsed.getUTCMonth() + 1}-${parsed.getUTCDate()}-${parsed.getUTCFullYear()}`;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(parsed);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}-${get("day")}-${get("year")} ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}
