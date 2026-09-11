export const SERVICE_SHIFT_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export const SERVICE_ASSIGNMENT_STATUSES = ["ASSIGNED", "CONFIRMED", "CANCELLED"] as const;
export const SERVICE_OUTCOMES = ["COMPLETED", "NO_SHOW"] as const;

type ShiftStatus = (typeof SERVICE_SHIFT_STATUSES)[number];
type AssignmentStatus = (typeof SERVICE_ASSIGNMENT_STATUSES)[number];
type ServiceOutcome = (typeof SERVICE_OUTCOMES)[number];

export class MembershipVolunteerInputError extends Error {}

function text(value: unknown, maximum: number, label: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new MembershipVolunteerInputError(`${label} must be text.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maximum) throw new MembershipVolunteerInputError(`${label} must be ${maximum} characters or fewer.`);
  return normalized || null;
}

function date(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new MembershipVolunteerInputError(`${label} must be a date.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new MembershipVolunteerInputError(`${label} must be a valid date.`);
  return parsed;
}

export function normalizeServiceOpportunityInput(value: unknown, partial = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MembershipVolunteerInputError("Opportunity details are required.");
  const input = value as Record<string, unknown>;
  const groupId = typeof input.groupId === "string" ? input.groupId.trim() : undefined;
  const title = text(input.title, 120, "Title");
  const description = text(input.description, 2000, "Description");
  const location = text(input.location, 200, "Location");
  const defaultRole = text(input.defaultRole, 100, "Default role");
  const isActive = input.isActive;
  if (!partial && !groupId) throw new MembershipVolunteerInputError("Volunteer group is required.");
  if (!partial && !title) throw new MembershipVolunteerInputError("Opportunity title is required.");
  if (isActive !== undefined && typeof isActive !== "boolean") throw new MembershipVolunteerInputError("Active must be true or false.");
  return {
    ...(groupId !== undefined ? { groupId } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(location !== undefined ? { location } : {}),
    ...(defaultRole !== undefined ? { defaultRole } : {}),
    ...(isActive !== undefined ? { isActive } : {})
  };
}

export function normalizeServiceShiftInput(value: unknown, partial = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MembershipVolunteerInputError("Event date details are required.");
  const input = value as Record<string, unknown>;
  const opportunityId = typeof input.opportunityId === "string" ? input.opportunityId.trim() : undefined;
  const startsAt = date(input.startsAt, "Start");
  const endsAt = date(input.endsAt, "End");
  const notes = text(input.notes, 1000, "Notes");
  const status = input.status;
  const capacityProvided = input.capacity !== undefined;
  const capacity = input.capacity === "" || input.capacity === null || input.capacity === undefined ? null : Number(input.capacity);
  if (startsAt === null) throw new MembershipVolunteerInputError("Event start cannot be cleared.");
  if (!partial && !opportunityId) throw new MembershipVolunteerInputError("Service opportunity is required.");
  if (!partial && !startsAt) throw new MembershipVolunteerInputError("Event start is required.");
  if (startsAt && endsAt && endsAt <= startsAt) throw new MembershipVolunteerInputError("Event end must be after its start.");
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)) throw new MembershipVolunteerInputError("Capacity must be a whole number from 1 to 1000.");
  if (status !== undefined && !SERVICE_SHIFT_STATUSES.includes(status as ShiftStatus)) throw new MembershipVolunteerInputError("Choose a valid event status.");
  return {
    ...(opportunityId !== undefined ? { opportunityId } : {}),
    ...(startsAt !== undefined ? { startsAt } : {}),
    ...(endsAt !== undefined ? { endsAt } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(capacityProvided ? { capacity } : {}),
    ...(status !== undefined ? { status: status as ShiftStatus } : {})
  };
}

export type ServiceAssignmentEntry = {
  individualId: string;
  assigned: boolean;
  status: AssignmentStatus;
  role: string | null;
  outcome: ServiceOutcome | null;
  minutesServed: number | null;
  notes: string | null;
};

export function normalizeServiceAssignments(value: unknown): ServiceAssignmentEntry[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new MembershipVolunteerInputError("Submit between 1 and 100 volunteer rows at a time.");
  const seen = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new MembershipVolunteerInputError("Each volunteer row must be an object.");
    const input = raw as Record<string, unknown>;
    const individualId = typeof input.individualId === "string" ? input.individualId.trim() : "";
    if (!individualId || seen.has(individualId)) throw new MembershipVolunteerInputError("Each volunteer row must reference a unique member.");
    seen.add(individualId);
    const assigned = input.assigned === true;
    const status = input.status || "ASSIGNED";
    if (!SERVICE_ASSIGNMENT_STATUSES.includes(status as AssignmentStatus)) throw new MembershipVolunteerInputError("Choose a valid assignment status.");
    const outcome = input.outcome === "" || input.outcome === null || input.outcome === undefined ? null : input.outcome;
    if (outcome !== null && !SERVICE_OUTCOMES.includes(outcome as ServiceOutcome)) throw new MembershipVolunteerInputError("Choose a valid service outcome.");
    if (outcome && !assigned) throw new MembershipVolunteerInputError("A service outcome requires an assigned volunteer.");
    const minutes = input.minutesServed === "" || input.minutesServed === null || input.minutesServed === undefined ? null : Number(input.minutesServed);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080)) throw new MembershipVolunteerInputError("Service minutes must be a whole number from 0 to 10080.");
    if (outcome === "NO_SHOW" && minutes !== null && minutes !== 0) throw new MembershipVolunteerInputError("A no-show cannot have service minutes.");
    return {
      individualId,
      assigned,
      status: status as AssignmentStatus,
      role: text(input.role, 100, "Role") ?? null,
      outcome: outcome as ServiceOutcome | null,
      minutesServed: outcome === "NO_SHOW" ? 0 : minutes,
      notes: text(input.notes, 500, "Service notes") ?? null
    };
  });
}

export function membershipServiceReportRow(record: {
  outcome: string;
  minutesServed: number | null;
  notes: string | null;
  recordedAt: Date;
  assignment: {
    role: string | null;
    status: string;
    shift: {
      id: string;
      startsAt: Date;
      endsAt: Date | null;
      opportunity: { id: string; title: string; location: string | null; group: { id: string; name: string } };
    };
  };
  individual: { id: string; memberNumber: number; firstName: string; lastName: string | null; family: { lastName: string } };
}) {
  return {
    individualId: record.individual.id,
    memberNumber: record.individual.memberNumber,
    memberName: `${record.individual.firstName} ${record.individual.lastName ?? record.individual.family.lastName}`,
    serviceOpportunity: record.assignment.shift.opportunity.title,
    serviceGroup: record.assignment.shift.opportunity.group.name,
    serviceRole: record.assignment.role,
    shiftStartsAt: record.assignment.shift.startsAt,
    shiftEndsAt: record.assignment.shift.endsAt,
    serviceLocation: record.assignment.shift.opportunity.location,
    assignmentStatus: record.assignment.status,
    serviceOutcome: record.outcome,
    minutesServed: record.minutesServed,
    serviceNotes: record.notes,
    serviceRecordedAt: record.recordedAt
  };
}
