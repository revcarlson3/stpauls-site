import { db } from "@/lib/db";
import { dynamicMemberIds } from "@/lib/membership-audiences";
import { membershipAttendanceReportRow } from "@/lib/membership-attendance";
import { membershipServiceReportRow } from "@/lib/membership-volunteers";
import { formatPhoneNumber } from "@/lib/phone-numbers";
import { formatReportDate } from "@/lib/report-date-format";

type Report = { reportType: string; criteria: unknown; sort?: unknown };
type Row = Record<string, unknown>;

function matches(row: Row, criteria: unknown) {
  const value = criteria && typeof criteria === "object" ? criteria as Record<string, unknown> : {};
  const conditions = Array.isArray(value.conditions) ? value.conditions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const results = conditions.map((condition) => {
    const actual = String(row[String(condition.field || "")] ?? "").toLowerCase();
    const expected = String(condition.value ?? "").toLowerCase();
    if (condition.operator === "contains") return actual.includes(expected);
    if (condition.operator === "not_equals" || condition.operator === "notEquals") return actual !== expected;
    return actual === expected;
  });
  return value.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

function sortRows(rows: Row[], sort: unknown) {
  const selected = Array.isArray(sort) && sort.length ? sort[0] as { key?: string; direction?: string } : { key: "name", direction: "asc" };
  const key = selected.key || "name";
  const direction = selected.direction === "desc" ? -1 : 1;
  return rows.sort((left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? "")) * direction);
}

export async function buildMembershipReportRows(report: Report): Promise<Row[]> {
  const criteria = report.criteria && typeof report.criteria === "object" ? report.criteria as Record<string, unknown> : {};
  if (report.reportType === "messaging-delivery") {
    const recipients = await db.membershipMessageRecipient.findMany({
      orderBy: { lastAttemptAt: "desc" },
      select: { id: true, displayName: true, address: true, status: true, attemptCount: true, deliveredAt: true, failureReason: true, message: { select: { subject: true, channel: true } } }
    });
    return sortRows(recipients.map((recipient) => ({ id: recipient.id, name: recipient.displayName, email: recipient.address, messageSubject: recipient.message.subject ?? "—", messageChannel: recipient.message.channel, deliveryStatus: recipient.status, attemptCount: recipient.attemptCount, deliveredAt: formatReportDate(recipient.deliveredAt), failureReason: recipient.failureReason ?? "—" })).filter((row) => matches(row, criteria)), report.sort);
  }
  const memberIds = await dynamicMemberIds(criteria);
  if (report.reportType === "attendance-participation") {
    const records = await db.membershipAttendanceRecord.findMany({
      where: { individualId: { in: memberIds } },
      orderBy: [{ event: { startsAt: "desc" } }, { individual: { lastName: "asc" } }],
      select: { id: true, status: true, source: true, checkedInAt: true, minutesParticipated: true, recordedAt: true, event: { select: { id: true, title: true, eventType: true, category: true, location: true, startsAt: true, endsAt: true, timeZone: true } }, individual: { select: { id: true, memberNumber: true, firstName: true, lastName: true, family: { select: { lastName: true } } } } }
    });
    return sortRows(records.map((record) => { const row = membershipAttendanceReportRow(record); return { id: record.id, ...row, eventStartsAt: formatReportDate(row.eventStartsAt, String(row.eventTimeZone)), eventEndsAt: formatReportDate(row.eventEndsAt, String(row.eventTimeZone)), checkedInAt: formatReportDate(row.checkedInAt), recordedAt: formatReportDate(row.recordedAt), name: row.memberName }; }).filter((row) => matches(row, criteria)), report.sort);
  }
  if (report.reportType === "service-history") {
    const records = await db.membershipServiceRecord.findMany({
      where: { individualId: { in: memberIds } },
      orderBy: [{ assignment: { shift: { startsAt: "desc" } } }, { individual: { lastName: "asc" } }],
      select: { id: true, outcome: true, minutesServed: true, notes: true, recordedAt: true, assignment: { select: { role: true, status: true, shift: { select: { id: true, startsAt: true, endsAt: true, opportunity: { select: { id: true, title: true, location: true, group: { select: { id: true, name: true } } } } } } } }, individual: { select: { id: true, memberNumber: true, firstName: true, lastName: true, family: { select: { lastName: true } } } } }
    });
    return sortRows(records.map((record) => { const row = membershipServiceReportRow(record); return { id: record.id, ...row, name: row.memberName, shiftStartsAt: formatReportDate(row.shiftStartsAt), shiftEndsAt: formatReportDate(row.shiftEndsAt), serviceNotes: row.serviceNotes ?? "—", serviceRecordedAt: formatReportDate(row.serviceRecordedAt) }; }).filter((row) => matches(row, criteria)), report.sort);
  }
  const members = await db.membershipIndividual.findMany({
    where: { id: { in: memberIds } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10000,
    select: { id: true, memberNumber: true, firstName: true, lastName: true, status: true, gradeLevel: true, ageCategoryOverride: true, email: true, emailMessagesAllowed: true, cellphone: true, smsMessagesAllowed: true, memberType: { select: { name: true } }, familyRole: { select: { name: true } }, customValues: { select: { definitionId: true, value: true } }, familyId: true, family: { select: { lastName: true, status: true, addressStreet: true, addressCity: true, addressState: true, addressZip: true, phone: true, customValues: { select: { definitionId: true, value: true } } } }, volunteerGroups: { select: { role: true, isLeader: true, group: { select: { name: true } } } }, volunteerAssignmentHistory: { select: { createdAt: true } }, otherPhone: true, otherPhoneType: true, maritalStatus: true, gender: true, birthday: true, weddingDate: true, deceasedDate: true }
  });
  const rows: Row[] = members.map((member) => {
    const row: Row = {
      id: member.id, memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName ?? member.family.lastName ?? ""}`.trim(), familyName: member.family.lastName, status: member.status,
      memberType: member.memberType.name, familyRole: member.familyRole.name, gradeLevel: member.gradeLevel ?? "—", ageCategory: member.ageCategoryOverride ?? "Calculated", gender: member.gender,
      birthMonthDay: `${String(member.birthday.getUTCMonth() + 1).padStart(2, "0")}-${String(member.birthday.getUTCDate()).padStart(2, "0")}`,
      addressStreet: member.family.addressStreet ?? "—", city: member.family.addressCity ?? "—", state: member.family.addressState ?? "—", zip: member.family.addressZip ?? "—",
      email: member.email ?? "—", emailConsent: member.emailMessagesAllowed ? "Yes" : "No", cellphone: formatPhoneNumber(member.cellphone), smsConsent: member.smsMessagesAllowed ? "Yes" : "No",
      otherPhone: formatPhoneNumber(member.otherPhone), otherPhoneType: member.otherPhoneType ?? "—", maritalStatus: member.maritalStatus,
      birthday: formatReportDate(member.birthday.toISOString().slice(0, 10)), weddingDate: formatReportDate(member.weddingDate?.toISOString().slice(0, 10)), deceasedDate: formatReportDate(member.deceasedDate?.toISOString().slice(0, 10)),
      volunteerGroups: member.volunteerGroups.map((item) => item.group.name).join(", ") || "—", volunteerGroupCount: member.volunteerGroups.length, volunteerRoles: member.volunteerGroups.map((item) => item.role).filter(Boolean).join(", ") || "—", volunteerLeader: member.volunteerGroups.some((item) => item.isLeader) ? "Yes" : "No",
      volunteerAssignmentCount: member.volunteerAssignmentHistory.length, lastVolunteerChange: formatReportDate(member.volunteerAssignmentHistory[0]?.createdAt)
    };
    member.customValues.forEach((value) => { row[`custom:${value.definitionId}`] = value.value; });
    member.family.customValues.forEach((value) => { row[`custom:${value.definitionId}`] = value.value; });
    return row;
  }).filter((row) => matches(row, criteria));
  if (report.reportType === "family-overview") {
    const families = new Map<string, Row>();
    for (const member of members) {
      const existing = families.get(member.familyId);
      const row = rows.find((item) => item.id === member.id) ?? {};
      if (existing) {
        existing.memberCount = Number(existing.memberCount) + 1;
        existing.activeMemberCount = Number(existing.activeMemberCount) + (member.status === "ACTIVE" ? 1 : 0);
        const groups = new Set(String(existing.volunteerGroups) === "—" ? [] : String(existing.volunteerGroups).split(", "));
        member.volunteerGroups.forEach((item) => groups.add(item.group.name));
        existing.volunteerGroups = groups.size ? Array.from(groups).join(", ") : "—";
        existing.volunteerGroupCount = groups.size;
        const roles = new Set(String(existing.volunteerRoles) === "—" ? [] : String(existing.volunteerRoles).split(", "));
        member.volunteerGroups.forEach((item) => { if (item.role) roles.add(item.role); });
        existing.volunteerRoles = roles.size ? Array.from(roles).join(", ") : "—";
        if (member.volunteerGroups.some((item) => item.isLeader)) existing.volunteerLeader = "Yes";
        continue;
      }
      families.set(member.familyId, { ...row, id: member.familyId, name: member.family.lastName, memberNumber: "", memberType: "", familyRole: "", gradeLevel: "", ageCategory: "", gender: "", birthMonthDay: "", email: "—", emailConsent: "—", cellphone: "—", smsConsent: "—", memberCount: 1, activeMemberCount: member.status === "ACTIVE" ? 1 : 0, status: member.family.status, addressStreet: member.family.addressStreet ?? "—", city: member.family.addressCity ?? "—", state: member.family.addressState ?? "—", zip: member.family.addressZip ?? "—", otherPhone: formatPhoneNumber(member.family.phone), otherPhoneType: "Family" });
    }
    return sortRows(Array.from(families.values()), report.sort);
  }
  return sortRows(rows, report.sort);
}
