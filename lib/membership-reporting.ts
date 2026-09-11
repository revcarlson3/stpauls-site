import type { DynamicCriteria } from "@/lib/membership-audiences";
import type { Prisma } from "@prisma/client";

export type MembershipReportType =
  | "membership-overview"
  | "family-overview"
  | "age-grade-distribution"
  | "member-type-distribution"
  | "missing-information"
  | "volunteer-participation"
  | "service-history"
  | "audience-membership"
  | "messaging-delivery"
  | "attendance-participation"
  | "custom";

export type MembershipReportColumn = {
  key: string;
  label: string;
  visible?: boolean;
};

export type MembershipReportSort = {
  key: string;
  direction: "asc" | "desc";
};

export type MembershipReportGrouping = {
  key?: string;
  direction?: "asc" | "desc";
};

export type MembershipReportLayout = {
  order?: string[];
  widths?: Record<string, number>;
  visibility?: Record<string, boolean>;
};

export type MembershipReportDefinition = {
  name: string;
  description?: string;
  reportType: MembershipReportType;
  criteria: DynamicCriteria;
  columns: MembershipReportColumn[];
  sort: MembershipReportSort[];
  grouping: MembershipReportGrouping;
  layout: MembershipReportLayout;
  striped: boolean;
  visibility: "PRIVATE" | "MEMBERSHIP_MANAGERS";
};

export type MembershipReportRow = { id: string; [key: string]: string | number };
export type MembershipReportGroupCount = { label: string; count: number };

export type MembershipReportRequest = {
  draw: number | null;
  start: number;
  length: number;
  page: number;
  pageSize: number;
  search: string;
  sortKey: string;
  sortDirection: Prisma.SortOrder;
};

export function parseMembershipReportRequest(searchParams: URLSearchParams): MembershipReportRequest {
  const drawValue = searchParams.get("draw");
  const start = Math.max(0, Number(searchParams.get("start") ?? "0") || 0);
  const length = Math.min(5000, Math.max(10, Number(searchParams.get("length") ?? "25") || 25));
  const page = Math.max(1, Number(searchParams.get("page") ?? "") || Math.floor(start / length) + 1);
  const pageSize = Math.min(5000, Math.max(10, Number(searchParams.get("pageSize") ?? String(length)) || length));
  const requestedColumnIndex = Number(searchParams.get("order[0][column]") ?? "-1");
  const requestedColumnKey = requestedColumnIndex >= 0 ? searchParams.get(`columns[${requestedColumnIndex}][name]`) : null;
  return {
    draw: drawValue === null ? null : Number(drawValue) || 0,
    start,
    length,
    page,
    pageSize,
    search: (searchParams.get("search[value]") ?? searchParams.get("search") ?? "").trim().toLowerCase(),
    sortKey: requestedColumnKey || searchParams.get("sort") || "name",
    sortDirection: (searchParams.get("order[0][dir]") ?? searchParams.get("direction")) === "desc" ? "desc" : "asc"
  };
}

export function membershipReportSearchWhere(search: string): Prisma.MembershipIndividualWhereInput {
  if (!search) return {};
  return {
    OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } }
    ]
  };
}

export function membershipReportOrderBy(sortKey: string, direction: Prisma.SortOrder): Prisma.MembershipIndividualOrderByWithRelationInput[] {
  const primary: Prisma.MembershipIndividualOrderByWithRelationInput =
    sortKey === "memberNumber" ? { memberNumber: direction }
      : sortKey === "status" ? { status: direction }
        : sortKey === "email" ? { email: direction }
          : sortKey === "gradeLevel" ? { gradeLevel: direction }
            : { lastName: direction };
  return [primary, { firstName: direction }];
}

export const DATABASE_MEMBERSHIP_GROUPINGS = new Set([
  "status",
  "gradeLevel",
  "ageCategory",
  "gender",
  "maritalStatus",
  "emailConsent",
  "smsConsent",
  "memberType",
  "familyRole"
]);

export function canRunStandardMemberReportInDatabase(reportType: string, sortKey: string, groupingKey: string) {
  return !["family-overview", "messaging-delivery", "attendance-participation", "service-history"].includes(reportType)
    && sortKey !== "birthMonthDay"
    && (!groupingKey || DATABASE_MEMBERSHIP_GROUPINGS.has(groupingKey));
}

export function sortMembershipReportGroupCounts(
  counts: MembershipReportGroupCount[],
  direction: unknown
) {
  return counts.sort((left, right) => left.label.localeCompare(right.label) * (direction === "desc" ? -1 : 1));
}

export function membershipReportResultPayload(input: {
  request: MembershipReportRequest;
  report: Record<string, unknown>;
  rows: MembershipReportRow[];
  recordsTotal: number;
  recordsFiltered: number;
}) {
  if (input.request.draw !== null) {
    return {
      draw: input.request.draw,
      recordsTotal: input.recordsTotal,
      recordsFiltered: input.recordsFiltered,
      data: input.rows,
      report: input.report
    };
  }
  return {
    report: input.report,
    rows: input.rows,
    total: input.recordsFiltered,
    page: input.request.page,
    pageSize: input.request.pageSize,
    pageCount: Math.max(1, Math.ceil(input.recordsFiltered / input.request.pageSize))
  };
}

export const MEMBERSHIP_REPORT_TYPES: Array<{ value: MembershipReportType; label: string; description: string }> = [
  { value: "membership-overview", label: "Membership overview", description: "Counts by member status and basic membership details." },
  { value: "family-overview", label: "Family overview", description: "One row per family with household membership counts and contact details." },
  { value: "age-grade-distribution", label: "Age and grade distribution", description: "Members grouped by age category and school grade." },
  { value: "member-type-distribution", label: "Member type distribution", description: "Members grouped by their membership type." },
  { value: "missing-information", label: "Missing information", description: "Members missing selected contact or profile information." },
  { value: "volunteer-participation", label: "Volunteer participation", description: "Volunteer group membership and participation." },
  { value: "service-history", label: "Volunteer service history", description: "Completed and no-show service records by shift, group, role, and duration." },
  { value: "audience-membership", label: "Audience membership", description: "Membership in reusable groups, lists, and dynamic audiences." },
  { value: "messaging-delivery", label: "Messaging delivery", description: "Message volume, delivery status, failures, and retries." },
  { value: "attendance-participation", label: "Attendance and participation", description: "Event attendance, volunteer roles, participation time, and absence history." },
  { value: "custom", label: "Custom report", description: "A reusable report built from configurable criteria and columns." }
];

export const DEFAULT_MEMBERSHIP_REPORT_COLUMNS: MembershipReportColumn[] = [
  { key: "memberNumber", label: "Member number" },
  { key: "name", label: "Name" },
  { key: "familyName", label: "Family name" },
  { key: "status", label: "Status" },
  { key: "memberType", label: "Member type" },
  { key: "familyRole", label: "Family role" },
  { key: "gradeLevel", label: "Grade level" },
  { key: "ageCategory", label: "Age category" },
  { key: "gender", label: "Gender" },
  { key: "birthMonthDay", label: "Birth month/day" },
  { key: "addressStreet", label: "Address street" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP code" },
  { key: "email", label: "Email" },
  { key: "emailConsent", label: "Email consent" },
  { key: "cellphone", label: "Cellphone" },
  { key: "smsConsent", label: "SMS consent" },
  { key: "otherPhone", label: "Other phone" },
  { key: "otherPhoneType", label: "Other phone type" },
  { key: "maritalStatus", label: "Marital status" },
  { key: "birthday", label: "Birthday" },
  { key: "weddingDate", label: "Wedding date" },
  { key: "deceasedDate", label: "Deceased date" },
  { key: "memberCount", label: "Family member count" },
  { key: "activeMemberCount", label: "Active member count" },
  { key: "volunteerGroups", label: "Volunteer groups" },
  { key: "volunteerGroupCount", label: "Volunteer group count" },
  { key: "volunteerRoles", label: "Volunteer roles" },
  { key: "volunteerLeader", label: "Volunteer leader" }
  ,{ key: "messageSubject", label: "Message subject" }
  ,{ key: "messageChannel", label: "Message channel" }
  ,{ key: "deliveryStatus", label: "Delivery status" }
  ,{ key: "attemptCount", label: "Attempt count" }
  ,{ key: "deliveredAt", label: "Delivered at" }
  ,{ key: "failureReason", label: "Failure reason" }
  ,{ key: "volunteerAssignmentCount", label: "Volunteer assignment changes" }
  ,{ key: "lastVolunteerChange", label: "Last volunteer change" }
  ,{ key: "eventTitle", label: "Event" }
  ,{ key: "eventType", label: "Event type" }
  ,{ key: "eventCategory", label: "Event category" }
  ,{ key: "eventLocation", label: "Event location" }
  ,{ key: "eventStartsAt", label: "Event starts" }
  ,{ key: "eventEndsAt", label: "Event ends" }
  ,{ key: "attendanceStatus", label: "Attendance status" }
  ,{ key: "participationType", label: "Participation type" }
  ,{ key: "attendanceSource", label: "Attendance source" }
  ,{ key: "checkedInAt", label: "Checked in" }
  ,{ key: "minutesParticipated", label: "Minutes participated" }
  ,{ key: "recordedAt", label: "Recorded at" }
  ,{ key: "serviceOpportunity", label: "Service opportunity" }
  ,{ key: "serviceGroup", label: "Volunteer group" }
  ,{ key: "serviceRole", label: "Service role" }
  ,{ key: "shiftStartsAt", label: "Shift starts" }
  ,{ key: "shiftEndsAt", label: "Shift ends" }
  ,{ key: "serviceLocation", label: "Service location" }
  ,{ key: "assignmentStatus", label: "Assignment status" }
  ,{ key: "serviceOutcome", label: "Service outcome" }
  ,{ key: "minutesServed", label: "Minutes served" }
  ,{ key: "serviceNotes", label: "Service notes" }
  ,{ key: "serviceRecordedAt", label: "Service recorded at" }
];
