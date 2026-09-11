import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { databaseDynamicWhere, dynamicMemberIds } from "@/lib/membership-audiences";
import {
  canRunStandardMemberReportInDatabase,
  DEFAULT_MEMBERSHIP_REPORT_COLUMNS,
  membershipReportOrderBy,
  membershipReportResultPayload,
  membershipReportSearchWhere,
  parseMembershipReportRequest,
  sortMembershipReportGroupCounts,
  type MembershipReportColumn,
  type MembershipReportGroupCount
} from "@/lib/membership-reporting";
import { formatPhoneNumber } from "@/lib/phone-numbers";
import { membershipAttendanceReportRow } from "@/lib/membership-attendance";
import { membershipServiceReportRow } from "@/lib/membership-volunteers";

async function databaseGroupingCounts(
  where: Prisma.MembershipIndividualWhereInput,
  groupingKey: string,
  direction: unknown,
  statusGroups: Array<{ status: string; _count: { _all: number } }>
): Promise<MembershipReportGroupCount[]> {
  let counts: MembershipReportGroupCount[] = [];
  if (!groupingKey) return counts;
  if (groupingKey === "status") {
    counts = statusGroups.map((group) => ({ label: group.status, count: group._count._all }));
  } else if (groupingKey === "gradeLevel") {
    const groups = await db.membershipIndividual.groupBy({ by: ["gradeLevel"], where, _count: { _all: true } });
    counts = groups.map((group) => ({ label: group.gradeLevel ?? "—", count: group._count._all }));
  } else if (groupingKey === "ageCategory") {
    const groups = await db.membershipIndividual.groupBy({ by: ["ageCategoryOverride"], where, _count: { _all: true } });
    counts = groups.map((group) => ({ label: group.ageCategoryOverride ?? "Calculated", count: group._count._all }));
  } else if (groupingKey === "gender") {
    const groups = await db.membershipIndividual.groupBy({ by: ["gender"], where, _count: { _all: true } });
    counts = groups.map((group) => ({ label: group.gender, count: group._count._all }));
  } else if (groupingKey === "maritalStatus") {
    const groups = await db.membershipIndividual.groupBy({ by: ["maritalStatus"], where, _count: { _all: true } });
    counts = groups.map((group) => ({ label: group.maritalStatus, count: group._count._all }));
  } else if (groupingKey === "emailConsent" || groupingKey === "smsConsent") {
    const field = groupingKey === "emailConsent" ? "emailMessagesAllowed" : "smsMessagesAllowed";
    const groups = field === "emailMessagesAllowed"
      ? await db.membershipIndividual.groupBy({ by: ["emailMessagesAllowed"], where, _count: { _all: true } })
      : await db.membershipIndividual.groupBy({ by: ["smsMessagesAllowed"], where, _count: { _all: true } });
    counts = groups.map((group) => {
      const allowed = "emailMessagesAllowed" in group ? group.emailMessagesAllowed : group.smsMessagesAllowed;
      return { label: allowed ? "Yes" : "No", count: group._count._all };
    });
  } else if (groupingKey === "memberType" || groupingKey === "familyRole") {
    const groups = groupingKey === "memberType"
      ? await db.membershipIndividual.groupBy({ by: ["memberTypeId"], where, _count: { _all: true } })
      : await db.membershipIndividual.groupBy({ by: ["familyRoleId"], where, _count: { _all: true } });
    const ids = groups.map((group) => "memberTypeId" in group ? group.memberTypeId : group.familyRoleId);
    const definitions = groupingKey === "memberType"
      ? await db.membershipMemberType.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : await db.membershipFamilyRole.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const labels = new Map(definitions.map((definition) => [definition.id, definition.name]));
    counts = groups.map((group) => {
      const id = "memberTypeId" in group ? group.memberTypeId : group.familyRoleId;
      return { label: labels.get(id) ?? "—", count: group._count._all };
    });
  }
  return sortMembershipReportGroupCounts(counts, direction);
}

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const report = await db.membershipReport.findFirst({ where: { id: context.params.id, OR: [{ createdById: user.id }, { visibility: "MEMBERSHIP_MANAGERS" }] } });
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const url = new URL(request.url);
    const reportRequest = parseMembershipReportRequest(url.searchParams);
    const { draw, start: serverStart, length: serverLength, page, pageSize, search, sortKey, sortDirection } = reportRequest;
    const requestedGrouping = report.grouping && typeof report.grouping === "object" ? report.grouping as { key?: unknown; direction?: unknown } : {};
    const requestedGroupingKey = typeof requestedGrouping.key === "string" ? requestedGrouping.key : "";
    const databaseAudienceWhere = canRunStandardMemberReportInDatabase(report.reportType, sortKey, requestedGroupingKey)
      ? databaseDynamicWhere(report.criteria)
      : null;
    if (report.reportType === "messaging-delivery") {
      const recipients = await db.membershipMessageRecipient.findMany({
        where: search ? { OR: [{ displayName: { contains: search, mode: "insensitive" } }, { address: { contains: search, mode: "insensitive" } }, { status: { contains: search, mode: "insensitive" } }] } : undefined,
        orderBy: { lastAttemptAt: "desc" },
        select: { id: true, displayName: true, address: true, status: true, attemptCount: true, deliveredAt: true, failureReason: true, message: { select: { subject: true, channel: true, createdAt: true } } }
      });
      const rows: Array<{ id: string; [key: string]: string | number }> = recipients.map((recipient) => ({ id: recipient.id, name: recipient.displayName, email: recipient.address, messageSubject: recipient.message.subject ?? "—", messageChannel: recipient.message.channel, deliveryStatus: recipient.status, attemptCount: recipient.attemptCount, deliveredAt: recipient.deliveredAt?.toISOString() ?? "—", failureReason: recipient.failureReason ?? "—" }));
      const availableColumns = DEFAULT_MEMBERSHIP_REPORT_COLUMNS;
      const selectedColumns = (Array.isArray(report.columns) ? report.columns : availableColumns).filter((column): column is MembershipReportColumn => Boolean(column) && typeof column === "object" && availableColumns.some((available) => available.key === String((column as MembershipReportColumn).key)));
      const safeColumns = selectedColumns.length ? selectedColumns : availableColumns;
      const groupingKey = report.grouping && typeof report.grouping === "object" && typeof (report.grouping as { key?: unknown }).key === "string" ? String((report.grouping as { key: string }).key) : "";
      const groupingCounts = groupingKey ? Object.entries(rows.reduce<Record<string, number>>((counts, row) => { const value = String(row[groupingKey] ?? "—"); counts[value] = (counts[value] ?? 0) + 1; return counts; }, {})).map(([label, count]) => ({ label, count })) : [];
      const summary = { total: rows.length, active: rows.filter((row) => row.deliveryStatus === "DELIVERED").length, inactive: rows.filter((row) => row.deliveryStatus !== "DELIVERED").length };
      const start = draw !== null ? serverStart : (page - 1) * pageSize;
      const resultRows = rows.slice(start, start + (draw !== null ? serverLength : pageSize));
      const reportMeta = { id: report.id, name: report.name, reportType: report.reportType, columns: safeColumns, grouping: groupingKey, groupingCounts, summary, layout: report.layout, generatedAt: new Date().toISOString(), generatedBy: user.name };
      if (draw !== null) return NextResponse.json({ draw, recordsTotal: rows.length, recordsFiltered: rows.length, data: resultRows, report: reportMeta });
      return NextResponse.json({ report: reportMeta, rows: resultRows, total: rows.length, page, pageSize, pageCount: Math.max(1, Math.ceil(rows.length / pageSize)) });
    }
    const memberIds = databaseAudienceWhere ? [] : await dynamicMemberIds(report.criteria);
    if (report.reportType === "attendance-participation") {
      const attendance = await db.membershipAttendanceRecord.findMany({
        where: {
          individualId: { in: memberIds },
          ...(search ? { OR: [
            { event: { title: { contains: search, mode: "insensitive" } } },
            { event: { category: { contains: search, mode: "insensitive" } } },
            { individual: { firstName: { contains: search, mode: "insensitive" } } },
            { individual: { lastName: { contains: search, mode: "insensitive" } } }
          ] } : {})
        },
        orderBy: [{ event: { startsAt: "desc" } }, { individual: { lastName: "asc" } }],
        select: {
          id: true, status: true, participationType: true, source: true, checkedInAt: true, minutesParticipated: true, recordedAt: true,
          event: { select: { id: true, title: true, eventType: true, category: true, location: true, startsAt: true, endsAt: true } },
          individual: { select: { id: true, memberNumber: true, firstName: true, lastName: true, family: { select: { lastName: true } } } }
        },
        take: 10000
      });
      const rows: Array<{ id: string; [key: string]: string | number }> = attendance.map((record) => {
        const row = membershipAttendanceReportRow(record);
        return {
          id: record.id,
          ...row,
          eventStartsAt: row.eventStartsAt.toISOString(),
          eventEndsAt: row.eventEndsAt?.toISOString() ?? "—",
          checkedInAt: row.checkedInAt?.toISOString() ?? "—",
          recordedAt: row.recordedAt.toISOString(),
          eventCategory: row.eventCategory ?? "—",
          eventLocation: row.eventLocation ?? "—",
          minutesParticipated: row.minutesParticipated ?? 0,
          name: row.memberName
        };
      });
      const availableColumns = DEFAULT_MEMBERSHIP_REPORT_COLUMNS;
      const selectedColumns = (Array.isArray(report.columns) ? report.columns : availableColumns).filter((column): column is MembershipReportColumn => Boolean(column) && typeof column === "object" && availableColumns.some((available) => available.key === String((column as MembershipReportColumn).key)));
      const safeColumns = selectedColumns.length ? selectedColumns : availableColumns;
      const groupingKey = report.grouping && typeof report.grouping === "object" && typeof (report.grouping as { key?: unknown }).key === "string" ? String((report.grouping as { key: string }).key) : "";
      const groupingCounts = groupingKey ? Object.entries(rows.reduce<Record<string, number>>((counts, row) => { const value = String(row[groupingKey] ?? "—"); counts[value] = (counts[value] ?? 0) + 1; return counts; }, {})).map(([label, count]) => ({ label, count })) : [];
      const summary = { total: rows.length, active: rows.filter((row) => row.attendanceStatus === "PRESENT").length, inactive: rows.filter((row) => row.attendanceStatus !== "PRESENT").length };
      const start = draw !== null ? serverStart : (page - 1) * pageSize;
      const resultRows = rows.slice(start, start + (draw !== null ? serverLength : pageSize));
      const reportMeta = { id: report.id, name: report.name, reportType: report.reportType, columns: safeColumns, grouping: groupingKey, groupingCounts, summary, layout: report.layout, generatedAt: new Date().toISOString(), generatedBy: user.name };
      if (draw !== null) return NextResponse.json({ draw, recordsTotal: rows.length, recordsFiltered: rows.length, data: resultRows, report: reportMeta });
      return NextResponse.json({ report: reportMeta, rows: resultRows, total: rows.length, page, pageSize, pageCount: Math.max(1, Math.ceil(rows.length / pageSize)) });
    }
    if (report.reportType === "service-history") {
      const serviceRecords = await db.membershipServiceRecord.findMany({
        where: {
          individualId: { in: memberIds },
          ...(search ? { OR: [
            { assignment: { shift: { opportunity: { title: { contains: search, mode: "insensitive" } } } } },
            { assignment: { shift: { opportunity: { group: { name: { contains: search, mode: "insensitive" } } } } } },
            { individual: { firstName: { contains: search, mode: "insensitive" } } },
            { individual: { lastName: { contains: search, mode: "insensitive" } } }
          ] } : {})
        },
        orderBy: [{ assignment: { shift: { startsAt: "desc" } } }, { individual: { lastName: "asc" } }],
        select: {
          id: true, outcome: true, minutesServed: true, notes: true, recordedAt: true,
          assignment: { select: { role: true, status: true, shift: { select: { id: true, startsAt: true, endsAt: true, opportunity: { select: { id: true, title: true, location: true, group: { select: { id: true, name: true } } } } } } } },
          individual: { select: { id: true, memberNumber: true, firstName: true, lastName: true, family: { select: { lastName: true } } } }
        },
        take: 10000
      });
      const rows: Array<{ id: string; [key: string]: string | number }> = serviceRecords.map((record) => {
        const row = membershipServiceReportRow(record);
        return {
          id: record.id,
          ...row,
          name: row.memberName,
          serviceRole: row.serviceRole ?? "—",
          serviceLocation: row.serviceLocation ?? "—",
          shiftStartsAt: row.shiftStartsAt.toISOString(),
          shiftEndsAt: row.shiftEndsAt?.toISOString() ?? "—",
          minutesServed: row.minutesServed ?? 0,
          serviceNotes: row.serviceNotes ?? "—",
          serviceRecordedAt: row.serviceRecordedAt.toISOString()
        };
      });
      const availableColumns = DEFAULT_MEMBERSHIP_REPORT_COLUMNS;
      const selectedColumns = (Array.isArray(report.columns) ? report.columns : availableColumns).filter((column): column is MembershipReportColumn => Boolean(column) && typeof column === "object" && availableColumns.some((available) => available.key === String((column as MembershipReportColumn).key)));
      const safeColumns = selectedColumns.length ? selectedColumns : availableColumns;
      const groupingKey = report.grouping && typeof report.grouping === "object" && typeof (report.grouping as { key?: unknown }).key === "string" ? String((report.grouping as { key: string }).key) : "";
      const groupingCounts = groupingKey ? Object.entries(rows.reduce<Record<string, number>>((counts, row) => { const value = String(row[groupingKey] ?? "—"); counts[value] = (counts[value] ?? 0) + 1; return counts; }, {})).map(([label, count]) => ({ label, count })) : [];
      const summary = { total: rows.length, active: rows.filter((row) => row.serviceOutcome === "COMPLETED").length, inactive: rows.filter((row) => row.serviceOutcome === "NO_SHOW").length };
      const start = draw !== null ? serverStart : (page - 1) * pageSize;
      const resultRows = rows.slice(start, start + (draw !== null ? serverLength : pageSize));
      const reportMeta = { id: report.id, name: report.name, reportType: report.reportType, columns: safeColumns, grouping: groupingKey, groupingCounts, summary, layout: report.layout, generatedAt: new Date().toISOString(), generatedBy: user.name };
      if (draw !== null) return NextResponse.json({ draw, recordsTotal: rows.length, recordsFiltered: rows.length, data: resultRows, report: reportMeta });
      return NextResponse.json({ report: reportMeta, rows: resultRows, total: rows.length, page, pageSize, pageCount: Math.max(1, Math.ceil(rows.length / pageSize)) });
    }
    const customDefinitions = await db.membershipCustomFieldDefinition.findMany({
      select: { id: true, name: true, appliesTo: true }
    });
    const customColumns = customDefinitions.map((field) => ({ key: `custom:${field.id}`, label: `${field.appliesTo === "FAMILY" ? "Family" : "Member"}: ${field.name}` }));
    const availableColumns = [...DEFAULT_MEMBERSHIP_REPORT_COLUMNS, ...customColumns];
    const availableColumnKeys = new Set(availableColumns.map((column) => column.key));
    const grouping = report.grouping && typeof report.grouping === "object" ? report.grouping as { key?: unknown; direction?: unknown } : {};
    const groupingKey = typeof grouping.key === "string" && availableColumnKeys.has(grouping.key) ? grouping.key : "";
    const databaseExecution = canRunStandardMemberReportInDatabase(report.reportType, sortKey, groupingKey);
    const audienceWhere: Prisma.MembershipIndividualWhereInput = databaseAudienceWhere ?? { id: { in: memberIds } };
    const filteredWhere: Prisma.MembershipIndividualWhereInput = { ...audienceWhere, ...membershipReportSearchWhere(search) };
    const resultStart = draw !== null ? serverStart : (page - 1) * pageSize;
    const resultLength = draw !== null ? serverLength : pageSize;
    const databaseCounts = databaseExecution
      ? await Promise.all([
        db.membershipIndividual.count({ where: audienceWhere }),
        db.membershipIndividual.count({ where: filteredWhere }),
        db.membershipIndividual.groupBy({ by: ["status"], where: filteredWhere, _count: { _all: true } })
      ])
      : null;
    const members = await db.membershipIndividual.findMany({
      where: filteredWhere,
      orderBy: membershipReportOrderBy(sortKey, sortDirection),
      ...(databaseExecution ? { skip: resultStart, take: resultLength } : {}),
      select: {
        id: true, memberNumber: true, firstName: true, lastName: true, status: true, gradeLevel: true, ageCategoryOverride: true, email: true, emailMessagesAllowed: true, cellphone: true, smsMessagesAllowed: true,
        memberType: { select: { name: true } },
        familyRole: { select: { name: true } },
        customValues: { select: { definitionId: true, value: true } },
        familyId: true,
        family: { select: { lastName: true, status: true, addressStreet: true, addressCity: true, addressState: true, addressZip: true, phone: true, customValues: { select: { definitionId: true, value: true } } } },
        volunteerGroups: { select: { role: true, isLeader: true, assignedAt: true, group: { select: { name: true } } } },
        volunteerAssignmentHistory: { select: { createdAt: true } },
        otherPhone: true, otherPhoneType: true, maritalStatus: true, gender: true, birthday: true, weddingDate: true, deceasedDate: true
      }
    });
    const columns = (Array.isArray(report.columns) ? report.columns : DEFAULT_MEMBERSHIP_REPORT_COLUMNS).filter((column): column is MembershipReportColumn => Boolean(column) && typeof column === "object" && availableColumnKeys.has(String((column as MembershipReportColumn).key)));
    const safeColumns = columns.length ? columns : DEFAULT_MEMBERSHIP_REPORT_COLUMNS;
    const rows: Array<{ id: string; [key: string]: string | number }> = members.map((member) => ({
      id: member.id,
      memberNumber: member.memberNumber,
      name: `${member.firstName} ${member.lastName ?? member.family.lastName ?? ""}`.trim(),
      familyName: member.family.lastName,
      status: member.status,
      memberType: member.memberType.name,
      familyRole: member.familyRole.name,
      gradeLevel: member.gradeLevel ?? "—",
      ageCategory: member.ageCategoryOverride ?? "Calculated",
      gender: member.gender,
      birthMonthDay: `${String(member.birthday.getUTCMonth() + 1).padStart(2, "0")}-${String(member.birthday.getUTCDate()).padStart(2, "0")}`,
      addressStreet: member.family.addressStreet ?? "—",
      city: member.family.addressCity ?? "—",
      state: member.family.addressState ?? "—",
      zip: member.family.addressZip ?? "—",
      email: member.email ?? "—",
      emailConsent: member.emailMessagesAllowed ? "Yes" : "No",
      cellphone: formatPhoneNumber(member.cellphone),
      smsConsent: member.smsMessagesAllowed ? "Yes" : "No",
      otherPhone: formatPhoneNumber(member.otherPhone),
      otherPhoneType: member.otherPhoneType ?? "—",
      maritalStatus: member.maritalStatus,
      birthday: member.birthday.toISOString().slice(0, 10),
      weddingDate: member.weddingDate?.toISOString().slice(0, 10) ?? "—",
      deceasedDate: member.deceasedDate?.toISOString().slice(0, 10) ?? "—",
      volunteerGroups: member.volunteerGroups.map((item) => item.group.name).join(", ") || "—",
      volunteerGroupCount: member.volunteerGroups.length,
      volunteerRoles: member.volunteerGroups.map((item) => item.role).filter(Boolean).join(", ") || "—",
      volunteerLeader: member.volunteerGroups.some((item) => item.isLeader) ? "Yes" : "No"
      ,volunteerAssignmentCount: member.volunteerAssignmentHistory.length
      ,lastVolunteerChange: member.volunteerAssignmentHistory[0]?.createdAt.toISOString() ?? "—"
    }));
    rows.forEach((row, index) => {
      const member = members[index];
      member.customValues.forEach((value) => { row[`custom:${value.definitionId}`] = value.value; });
      member.family.customValues.forEach((value) => { row[`custom:${value.definitionId}`] = value.value; });
    });
    if (databaseExecution && databaseCounts) {
      const [recordsTotal, recordsFiltered, statusGroups] = databaseCounts;
      const groupingCounts = await databaseGroupingCounts(filteredWhere, groupingKey, grouping.direction, statusGroups);
      const active = statusGroups.find((group) => group.status === "ACTIVE")?._count._all ?? 0;
      const summary = { total: recordsFiltered, active, inactive: recordsFiltered - active };
      const reportMeta = { id: report.id, name: report.name, reportType: report.reportType, columns: safeColumns, grouping: groupingKey, groupingCounts, summary, layout: report.layout, striped: report.striped, generatedAt: new Date().toISOString(), generatedBy: user.name };
      return NextResponse.json(membershipReportResultPayload({
        request: reportRequest,
        report: reportMeta,
        rows,
        recordsTotal,
        recordsFiltered
      }));
    }
    if (report.reportType === "family-overview") {
      const familyRows = new Map<string, { id: string; [key: string]: string | number }>();
      members.forEach((member, index) => {
        const memberRow = rows[index];
        const existing = familyRows.get(member.familyId);
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
          return;
        }
        familyRows.set(member.familyId, {
          id: member.familyId,
          memberNumber: "",
          name: member.family.lastName,
          familyName: member.family.lastName,
          status: member.family.status,
          memberType: "",
          familyRole: "",
          gradeLevel: "",
          ageCategory: "",
          gender: "",
          birthMonthDay: "",
          addressStreet: member.family.addressStreet ?? "—",
          city: member.family.addressCity ?? "—",
          state: member.family.addressState ?? "—",
          zip: member.family.addressZip ?? "—",
          email: "—",
          emailConsent: "—",
          cellphone: "—",
          smsConsent: "—",
          otherPhone: formatPhoneNumber(member.family.phone),
          otherPhoneType: "Family",
          maritalStatus: "",
          birthday: "",
          weddingDate: "",
          deceasedDate: "",
          memberCount: 1,
          activeMemberCount: member.status === "ACTIVE" ? 1 : 0,
          volunteerGroups: memberRow.volunteerGroups,
          volunteerGroupCount: Number(memberRow.volunteerGroupCount),
          volunteerRoles: memberRow.volunteerRoles,
          volunteerLeader: memberRow.volunteerLeader
          ,volunteerAssignmentCount: Number(memberRow.volunteerAssignmentCount)
          ,lastVolunteerChange: memberRow.lastVolunteerChange
        });
      });
      rows.splice(0, rows.length, ...Array.from(familyRows.values()));
    }
    if (sortKey === "birthMonthDay") {
      rows.sort((left, right) => String(left.birthMonthDay).localeCompare(String(right.birthMonthDay)) * (sortDirection === "desc" ? -1 : 1));
    }
    const groupingCounts = groupingKey
      ? Object.entries(rows.reduce<Record<string, number>>((counts, row) => {
        const value = String(row[groupingKey] ?? "—");
        counts[value] = (counts[value] ?? 0) + 1;
        return counts;
      }, {})).sort(([left], [right]) => left.localeCompare(right) * (grouping.direction === "desc" ? -1 : 1))
        .map(([label, count]) => ({ label, count }))
      : [];
    const statusCounts = rows.reduce<Record<string, number>>((counts, row) => {
      const status = String(row.status ?? "Unknown");
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const summary = {
      total: rows.length,
      active: statusCounts.ACTIVE ?? 0,
      inactive: rows.length - (statusCounts.ACTIVE ?? 0)
    };
    const start = draw !== null ? serverStart : (page - 1) * pageSize;
    const resultRows = rows.slice(start, start + (draw !== null ? serverLength : pageSize));
    const reportMeta = { id: report.id, name: report.name, reportType: report.reportType, columns: safeColumns, grouping: groupingKey, groupingCounts, summary, layout: report.layout, striped: report.striped, generatedAt: new Date().toISOString(), generatedBy: user.name };
    if (draw !== null) return NextResponse.json({ draw, recordsTotal: rows.length, recordsFiltered: rows.length, data: resultRows, report: reportMeta });
    return NextResponse.json({ report: reportMeta, rows: resultRows, total: rows.length, page, pageSize, pageCount: Math.max(1, Math.ceil(rows.length / pageSize)) });
  } catch {
    return NextResponse.json({ error: "Unable to run report." }, { status: 403 });
  }
}
