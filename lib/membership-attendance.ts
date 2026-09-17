export const MEMBERSHIP_EVENT_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export const MEMBERSHIP_ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "EXCUSED"] as const;

type EventStatus = (typeof MEMBERSHIP_EVENT_STATUSES)[number];
type AttendanceStatus = (typeof MEMBERSHIP_ATTENDANCE_STATUSES)[number];

export class MembershipAttendanceInputError extends Error {}

function text(value: unknown, maximum: number, label: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new MembershipAttendanceInputError(`${label} must be text.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maximum) throw new MembershipAttendanceInputError(`${label} must be ${maximum} characters or fewer.`);
  return normalized || null;
}

function date(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new MembershipAttendanceInputError(`${label} must be a date.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new MembershipAttendanceInputError(`${label} must be a valid date.`);
  return parsed;
}

export function normalizeMembershipEventInput(value: unknown, partial = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MembershipAttendanceInputError("Event details are required.");
  const input = value as Record<string, unknown>;
  const title = text(input.title, 120, "Title");
  const description = text(input.description, 2000, "Description");
  const category = text(input.category, 100, "Category");
  const location = text(input.location, 200, "Location");
  const timeZone = text(input.timeZone, 100, "Time zone");
  const startsAt = date(input.startsAt, "Start");
  const endsAt = date(input.endsAt, "End");
  const eventType = input.eventType;
  const status = input.status;

  if (!partial && !title) throw new MembershipAttendanceInputError("Event title is required.");
  if (!partial && !startsAt) throw new MembershipAttendanceInputError("Event start is required.");
  if (eventType !== undefined && (typeof eventType !== "string" || !eventType.trim())) throw new MembershipAttendanceInputError("Choose a valid event type.");
  if (status !== undefined && !MEMBERSHIP_EVENT_STATUSES.includes(status as EventStatus)) throw new MembershipAttendanceInputError("Choose a valid event status.");
  if (startsAt && endsAt && endsAt <= startsAt) throw new MembershipAttendanceInputError("Event end must be after its start.");

  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(location !== undefined ? { location } : {}),
    ...(timeZone !== undefined ? { timeZone } : {}),
    ...(startsAt !== undefined ? { startsAt } : {}),
    ...(endsAt !== undefined ? { endsAt } : {}),
    ...(eventType !== undefined ? { eventType: eventType as string } : {}),
    ...(status !== undefined ? { status: status as EventStatus } : {})
  };
}

export type AttendanceEntry = {
  individualId: string;
  status: AttendanceStatus | null;
  minutesParticipated: number | null;
  notes: string | null;
};

export function normalizeAttendanceEntries(value: unknown): AttendanceEntry[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new MembershipAttendanceInputError("Submit between 1 and 100 attendance rows at a time.");
  const seen = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new MembershipAttendanceInputError("Each attendance row must be an object.");
    const input = raw as Record<string, unknown>;
    const individualId = typeof input.individualId === "string" ? input.individualId.trim() : "";
    if (!individualId || seen.has(individualId)) throw new MembershipAttendanceInputError("Each attendance row must reference a unique member.");
    seen.add(individualId);
    const status = input.status === "" || input.status === null ? null : input.status;
    if (status !== null && !MEMBERSHIP_ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) throw new MembershipAttendanceInputError("Choose a valid attendance status.");
    const minutes = input.minutesParticipated === "" || input.minutesParticipated === null || input.minutesParticipated === undefined ? null : Number(input.minutesParticipated);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080)) throw new MembershipAttendanceInputError("Attendance minutes must be a whole number from 0 to 10080.");
    const notes = text(input.notes, 500, "Attendance notes") ?? null;
    return { individualId, status: status as AttendanceStatus | null, minutesParticipated: minutes, notes };
  });
}

export function membershipAttendanceReportRow(record: {
  status: string;
  source: string;
  checkedInAt: Date | null;
  minutesParticipated: number | null;
  recordedAt: Date;
  event: { id: string; title: string; eventType: string; category: string | null; location: string | null; startsAt: Date; endsAt: Date | null; timeZone?: string | null };
  individual: { id: string; memberNumber: number; firstName: string; lastName: string | null; family: { lastName: string } };
}) {
  return {
    eventId: record.event.id,
    eventTitle: record.event.title,
    eventType: record.event.eventType,
    eventCategory: record.event.category,
    eventLocation: record.event.location,
    eventStartsAt: record.event.startsAt,
    eventEndsAt: record.event.endsAt,
    eventTimeZone: record.event.timeZone ?? "America/Chicago",
    individualId: record.individual.id,
    memberNumber: record.individual.memberNumber,
    memberName: `${record.individual.firstName} ${record.individual.lastName ?? record.individual.family.lastName}`,
    attendanceStatus: record.status,
    attendanceSource: record.source,
    checkedInAt: record.checkedInAt,
    minutesParticipated: record.minutesParticipated,
    recordedAt: record.recordedAt
  };
}
