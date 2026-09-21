export const EVENT_REPORT_TYPES = [
  { value: "event-list", label: "Event report" },
  { value: "attendance", label: "Attendance report" },
  { value: "absentee", label: "Absentee report" },
  { value: "volunteers", label: "Volunteers report" },
  { value: "volunteer-schedule", label: "Volunteer schedule" },
  { value: "custom", label: "Custom report" }
] as const;
export const EVENT_TYPE_LABELS: Record<string, string> = { WORSHIP: "Worship", CLASS: "Class", FELLOWSHIP: "Fellowship", OUTREACH: "Outreach", MEETING: "Meeting", OTHER: "Other" };

export type EventReportType = (typeof EVENT_REPORT_TYPES)[number]["value"];
export type EventReportColumn = { key: string; label: string };
export type EventReportSummaryRow = { _eventId?: unknown; id?: unknown; attendanceCount?: unknown; _absenceCount?: unknown; attendanceStatus?: unknown; visitorCount?: unknown; _volunteerAssignmentCount?: unknown };

export const EVENT_REPORT_COLUMNS: EventReportColumn[] = [
  { key: "eventTitle", label: "Event" },
  { key: "eventType", label: "Event type" },
  { key: "eventStatus", label: "Status" },
  { key: "eventStartsAt", label: "Starts" },
  { key: "eventEndsAt", label: "Ends" },
  { key: "eventCategory", label: "Category" },
  { key: "eventLocation", label: "Location" },
  { key: "attendanceCount", label: "Attending" },
  { key: "visitorCount", label: "Visitors" },
  { key: "totalAttendance", label: "Total attendance" },
  { key: "memberNumber", label: "Member number" },
  { key: "memberName", label: "Member" },
  { key: "attendanceStatus", label: "Attendance status" },
  { key: "volunteerGroup", label: "Volunteer group" },
  { key: "volunteerName", label: "Volunteer" },
  { key: "assignmentSource", label: "Assignment source" }
];

export function eventReportSummary(type: EventReportType, rows: EventReportSummaryRow[]) {
  const eventRows = type === "event-list" || type === "custom";
  const eventIds = new Set(rows.map((row) => String(row._eventId || row.id)));
  return {
    attendance: eventRows ? rows.reduce((sum, row) => sum + Number(row.attendanceCount || 0), 0) : rows.filter((row) => row.attendanceStatus === "PRESENT").length,
    absences: eventRows ? rows.reduce((sum, row) => sum + Number(row._absenceCount || 0), 0) : rows.filter((row) => row.attendanceStatus === "ABSENT").length,
    visitors: Array.from(eventIds).reduce((sum, eventId) => sum + Number(rows.find((row) => String(row._eventId || row.id) === eventId)?.visitorCount || 0), 0),
    volunteerAssignments: type === "volunteers" ? rows.length : rows.reduce((sum, row) => sum + Number(row._volunteerAssignmentCount || 0), 0)
  };
}

export function eventReportPreset(type: EventReportType) {
  const presets: Record<EventReportType, { columns: string[]; sortKey: string; sortDirection: "asc" | "desc"; groupingKey: string }> = {
    "event-list": { columns: ["eventTitle", "eventType", "eventStatus", "eventStartsAt", "eventLocation", "attendanceCount", "visitorCount", "totalAttendance"], sortKey: "eventStartsAt", sortDirection: "desc", groupingKey: "eventStatus" },
    attendance: { columns: ["eventTitle", "eventStartsAt", "memberNumber", "memberName", "attendanceStatus"], sortKey: "eventStartsAt", sortDirection: "desc", groupingKey: "attendanceStatus" },
    absentee: { columns: ["eventTitle", "eventStartsAt", "memberNumber", "memberName", "attendanceStatus"], sortKey: "eventStartsAt", sortDirection: "desc", groupingKey: "eventTitle" },
    volunteers: { columns: ["eventTitle", "eventStartsAt", "volunteerGroup", "volunteerName", "assignmentSource"], sortKey: "eventStartsAt", sortDirection: "desc", groupingKey: "volunteerGroup" },
    "volunteer-schedule": { columns: ["eventDate"], sortKey: "eventDate", sortDirection: "asc", groupingKey: "" },
    custom: { columns: EVENT_REPORT_COLUMNS.map((column) => column.key), sortKey: "eventStartsAt", sortDirection: "desc", groupingKey: "" }
  };
  return presets[type];
}
