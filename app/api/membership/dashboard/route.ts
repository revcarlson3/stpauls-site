import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  annualDateKeys,
  activeMembershipIndividualSql,
  activeMembershipIndividualWhere,
  anniversaryYears,
  anniversaryDisplayName,
  displayMemberName,
  MEMBERSHIP_DASHBOARD_DATE_WINDOW_DAYS,
  MEMBERSHIP_DASHBOARD_DETAIL_LIMIT,
  MEMBERSHIP_DASHBOARD_ENGAGEMENT_DAYS,
  missingProfileFields,
  nextAnnualOccurrence,
  normalizeDashboardLayout,
  percentage,
  periodComparison
} from "@/lib/membership-dashboard";
import { requireEnabledModule } from "@/lib/modules";

type AnnualRow = {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  familyLastName: string;
  familyRoleSlug: string;
  date: Date;
};

type CountRow = { count: number };
type VolunteerSummaryRow = { shiftCount: number; requiredSlots: number; coveredSlots: number; openSlots: number };
type VolunteerGapRow = { id: string; title: string; groupName: string; startsAt: Date; capacity: number; assigned: number };
type AttendanceTrendRow = { startsAt: Date; count: number };

const activeMemberWhere = activeMembershipIndividualWhere;

const incompleteProfileWhere: Prisma.MembershipIndividualWhereInput = {
  ...activeMemberWhere,
  OR: [
    { AND: [{ OR: [{ email: null }, { email: "" }] }, { family: { OR: [{ email: null }, { email: "" }] } }] },
    { AND: [{ OR: [{ cellphone: null }, { cellphone: "" }] }, { OR: [{ otherPhone: null }, { otherPhone: "" }] }, { family: { OR: [{ phone: null }, { phone: "" }] } }] },
    { family: { OR: [{ addressStreet: null }, { addressStreet: "" }, { addressCity: null }, { addressCity: "" }, { addressState: null }, { addressState: "" }, { addressZip: null }, { addressZip: "" }] } }
  ]
};

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return user;
}

export async function GET() {
  try {
    const user = await authorize();

    const now = new Date();
    const today = startOfUtcDay(now);
    const attendanceSince = new Date(now);
    attendanceSince.setUTCDate(attendanceSince.getUTCDate() - MEMBERSHIP_DASHBOARD_ENGAGEMENT_DAYS);
    const priorAttendanceSince = new Date(attendanceSince);
    priorAttendanceSince.setUTCDate(priorAttendanceSince.getUTCDate() - MEMBERSHIP_DASHBOARD_ENGAGEMENT_DAYS);
    const coverageUntil = new Date(now);
    coverageUntil.setUTCDate(coverageUntil.getUTCDate() + MEMBERSHIP_DASHBOARD_DATE_WINDOW_DAYS);
    const priorCoverageSince = new Date(now);
    priorCoverageSince.setUTCDate(priorCoverageSince.getUTCDate() - MEMBERSHIP_DASHBOARD_DATE_WINDOW_DAYS);
    const dateKeys = annualDateKeys(today, MEMBERSHIP_DASHBOARD_DATE_WINDOW_DAYS);
    const detailLimit = MEMBERSHIP_DASHBOARD_DETAIL_LIMIT;

    const [
      dashboardPreference,
      birthdayRows,
      anniversaryRows,
      activeMembers,
      incompleteProfiles,
      incompleteProfileCount,
      attendanceByStatus,
      recentEventCount,
      engagedRows,
      priorPresentAttendance,
      priorEventCount,
      priorEngagedRows,
      attendanceTrendRows,
      volunteerGroups,
      volunteerRows,
      volunteerSummaryRows,
      priorVolunteerSummaryRows,
      volunteerGapRows
    ] = await Promise.all([
      db.membershipDashboardPreference.findUnique({
        where: { userId: user.id },
        select: { configuration: true }
      }),
      db.$queryRaw<AnnualRow[]>(Prisma.sql`
        SELECT i.id, i."familyId", i."firstName",
          COALESCE(i."lastName", f."lastName") AS "lastName",
          f."lastName" AS "familyLastName", role.slug AS "familyRoleSlug", i.birthday AS date
        FROM "MembershipIndividual" i
        JOIN "MembershipFamily" f ON f.id = i."familyId"
        JOIN "MembershipFamilyRole" role ON role.id = i."familyRoleId"
        WHERE ${activeMembershipIndividualSql}
          AND to_char(i.birthday, 'MM-DD') IN (${Prisma.join(dateKeys)})
        ORDER BY array_position(ARRAY[${Prisma.join(dateKeys)}]::text[], to_char(i.birthday, 'MM-DD')),
          f."lastName", i."firstName"
        LIMIT ${detailLimit}
      `),
      db.$queryRaw<AnnualRow[]>(Prisma.sql`
        SELECT i.id, i."familyId", i."firstName",
          COALESCE(i."lastName", f."lastName") AS "lastName",
          f."lastName" AS "familyLastName", role.slug AS "familyRoleSlug", i."weddingDate" AS date
        FROM "MembershipIndividual" i
        JOIN "MembershipFamily" f ON f.id = i."familyId"
        JOIN "MembershipFamilyRole" role ON role.id = i."familyRoleId"
        WHERE ${activeMembershipIndividualSql} AND i."weddingDate" IS NOT NULL
          AND to_char(i."weddingDate", 'MM-DD') IN (${Prisma.join(dateKeys)})
        ORDER BY array_position(ARRAY[${Prisma.join(dateKeys)}]::text[], to_char(i."weddingDate", 'MM-DD')),
          f."lastName",
          CASE WHEN role.slug = 'head-of-household' THEN 0 WHEN role.slug = 'spouse' THEN 1 ELSE 2 END,
          i."firstName"
        LIMIT ${detailLimit * 3}
      `),
      db.membershipIndividual.count({ where: activeMemberWhere }),
      db.membershipIndividual.findMany({
        where: incompleteProfileWhere,
        orderBy: [{ family: { lastName: "asc" } }, { firstName: "asc" }],
        take: detailLimit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          cellphone: true,
          otherPhone: true,
          family: { select: { lastName: true, email: true, phone: true, addressStreet: true, addressCity: true, addressState: true, addressZip: true } }
        }
      }),
      db.membershipIndividual.count({ where: incompleteProfileWhere }),
      db.membershipAttendanceRecord.groupBy({
        by: ["status"],
        where: { event: { startsAt: { gte: attendanceSince, lte: now }, status: { not: "CANCELLED" } } },
        _count: { _all: true }
      }),
      db.membershipEvent.count({ where: { startsAt: { gte: attendanceSince, lte: now }, status: { not: "CANCELLED" } } }),
      db.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT ar."individualId")::int AS count
        FROM "MembershipAttendanceRecord" ar
        JOIN "MembershipEvent" event ON event.id = ar."eventId"
        WHERE ar.status = 'PRESENT'
          AND event.status <> 'CANCELLED'
          AND event."startsAt" >= ${attendanceSince}
          AND event."startsAt" <= ${now}
      `),
      db.membershipAttendanceRecord.count({
        where: {
          status: "PRESENT",
          event: { startsAt: { gte: priorAttendanceSince, lt: attendanceSince }, status: { not: "CANCELLED" } }
        }
      }),
      db.membershipEvent.count({
        where: { startsAt: { gte: priorAttendanceSince, lt: attendanceSince }, status: { not: "CANCELLED" } }
      }),
      db.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT ar."individualId")::int AS count
        FROM "MembershipAttendanceRecord" ar
        JOIN "MembershipEvent" event ON event.id = ar."eventId"
        WHERE ar.status = 'PRESENT'
          AND event.status <> 'CANCELLED'
          AND event."startsAt" >= ${priorAttendanceSince}
          AND event."startsAt" < ${attendanceSince}
      `),
      db.$queryRaw<AttendanceTrendRow[]>(Prisma.sql`
        WITH buckets AS (
          SELECT generate_series(
            date_trunc('week', ${attendanceSince}),
            date_trunc('week', ${now}),
            interval '1 week'
          ) AS "startsAt"
        ),
        attendance AS (
          SELECT date_trunc('week', event."startsAt") AS "startsAt", COUNT(*)::int AS count
          FROM "MembershipAttendanceRecord" record
          JOIN "MembershipEvent" event ON event.id = record."eventId"
          WHERE record.status = 'PRESENT'
            AND event.status <> 'CANCELLED'
            AND event."startsAt" >= ${attendanceSince}
            AND event."startsAt" <= ${now}
          GROUP BY date_trunc('week', event."startsAt")
        )
        SELECT buckets."startsAt", COALESCE(attendance.count, 0)::int AS count
        FROM buckets
        LEFT JOIN attendance USING ("startsAt")
        ORDER BY buckets."startsAt"
      `),
      db.membershipVolunteerGroup.count(),
      db.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT member."individualId")::int AS count
        FROM "MembershipVolunteerGroupMember" member
        JOIN "MembershipIndividual" individual ON individual.id = member."individualId"
        WHERE individual.status <> 'REMOVED'
      `),
      db.$queryRaw<VolunteerSummaryRow[]>(Prisma.sql`
        WITH shift_coverage AS (
          SELECT shift.id, COALESCE(shift.capacity, 0)::int AS capacity,
            COUNT(assignment.id) FILTER (WHERE assignment.status <> 'CANCELLED')::int AS assigned
          FROM "MembershipServiceShift" shift
          LEFT JOIN "MembershipServiceAssignment" assignment ON assignment."shiftId" = shift.id
          WHERE shift.status = 'SCHEDULED'
            AND shift."startsAt" >= ${now}
            AND shift."startsAt" <= ${coverageUntil}
          GROUP BY shift.id
        )
        SELECT COUNT(*)::int AS "shiftCount",
          COALESCE(SUM(capacity), 0)::int AS "requiredSlots",
          COALESCE(SUM(LEAST(capacity, assigned)), 0)::int AS "coveredSlots",
          COALESCE(SUM(GREATEST(capacity - assigned, 0)), 0)::int AS "openSlots"
        FROM shift_coverage
      `),
      db.$queryRaw<VolunteerSummaryRow[]>(Prisma.sql`
        WITH shift_coverage AS (
          SELECT shift.id, COALESCE(shift.capacity, 0)::int AS capacity,
            COUNT(assignment.id) FILTER (WHERE assignment.status <> 'CANCELLED')::int AS assigned
          FROM "MembershipServiceShift" shift
          LEFT JOIN "MembershipServiceAssignment" assignment ON assignment."shiftId" = shift.id
          WHERE shift.status <> 'CANCELLED'
            AND shift."startsAt" >= ${priorCoverageSince}
            AND shift."startsAt" < ${now}
          GROUP BY shift.id
        )
        SELECT COUNT(*)::int AS "shiftCount",
          COALESCE(SUM(capacity), 0)::int AS "requiredSlots",
          COALESCE(SUM(LEAST(capacity, assigned)), 0)::int AS "coveredSlots",
          COALESCE(SUM(GREATEST(capacity - assigned, 0)), 0)::int AS "openSlots"
        FROM shift_coverage
      `),
      db.$queryRaw<VolunteerGapRow[]>(Prisma.sql`
        SELECT shift.id, opportunity.title, volunteer_group.name AS "groupName",
          shift."startsAt", shift.capacity,
          COUNT(assignment.id) FILTER (WHERE assignment.status <> 'CANCELLED')::int AS assigned
        FROM "MembershipServiceShift" shift
        JOIN "MembershipServiceOpportunity" opportunity ON opportunity.id = shift."opportunityId"
        JOIN "MembershipVolunteerGroup" volunteer_group ON volunteer_group.id = opportunity."groupId"
        LEFT JOIN "MembershipServiceAssignment" assignment ON assignment."shiftId" = shift.id
        WHERE shift.status = 'SCHEDULED'
          AND shift.capacity IS NOT NULL AND shift.capacity > 0
          AND shift."startsAt" >= ${now}
          AND shift."startsAt" <= ${coverageUntil}
        GROUP BY shift.id, opportunity.title, volunteer_group.name
        HAVING COUNT(assignment.id) FILTER (WHERE assignment.status <> 'CANCELLED') < shift.capacity
        ORDER BY shift."startsAt", opportunity.title
        LIMIT ${detailLimit}
      `)
    ]);

    const anniversaryMembers = new Map<string, AnnualRow[]>();
    anniversaryRows.forEach((row) => {
      const key = `${row.familyId}:${row.date.toISOString().slice(5, 10)}`;
      anniversaryMembers.set(key, [...(anniversaryMembers.get(key) ?? []), row]);
    });
    const anniversaries = Array.from(anniversaryMembers.values()).map((members) => {
      const row = members[0];
      const occurrence = nextAnnualOccurrence(row.date, today);
      return {
        id: members.find((member) => member.familyRoleSlug === "head-of-household")?.id ?? row.id,
        familyId: row.familyId,
        name: anniversaryDisplayName(members),
        date: occurrence.toISOString(),
        years: anniversaryYears(row.date, occurrence)
      };
    });

    const presentAttendance = attendanceByStatus.find((item) => item.status === "PRESENT")?._count._all ?? 0;
    const engagedMembers = engagedRows[0]?.count ?? 0;
    const priorEngagedMembers = priorEngagedRows[0]?.count ?? 0;
    const volunteerSummary = volunteerSummaryRows[0] ?? { shiftCount: 0, requiredSlots: 0, coveredSlots: 0, openSlots: 0 };
    const priorVolunteerSummary = priorVolunteerSummaryRows[0] ?? { shiftCount: 0, requiredSlots: 0, coveredSlots: 0, openSlots: 0 };
    const engagementPercent = percentage(engagedMembers, activeMembers);
    const priorEngagementPercent = percentage(priorEngagedMembers, activeMembers);
    const coveragePercent = percentage(volunteerSummary.coveredSlots, volunteerSummary.requiredSlots);
    const priorCoveragePercent = percentage(priorVolunteerSummary.coveredSlots, priorVolunteerSummary.requiredSlots);

    return NextResponse.json({
      generatedAt: now.toISOString(),
      layout: normalizeDashboardLayout(dashboardPreference?.configuration),
      layoutSaved: Boolean(dashboardPreference),
      dateWindowDays: MEMBERSHIP_DASHBOARD_DATE_WINDOW_DAYS,
      birthdays: birthdayRows.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`,
        date: nextAnnualOccurrence(row.date, today).toISOString()
      })),
      anniversaries: Array.from(anniversaries.values()).slice(0, detailLimit),
      incompleteProfiles: {
        count: incompleteProfileCount,
        completionPercent: percentage(activeMembers - incompleteProfileCount, activeMembers),
        members: incompleteProfiles.map((member) => ({
          id: member.id,
          name: displayMemberName(member),
          missing: missingProfileFields(member)
        }))
      },
      engagement: {
        windowDays: MEMBERSHIP_DASHBOARD_ENGAGEMENT_DAYS,
        activeMembers,
        engagedMembers,
        engagementPercent,
        eventCount: recentEventCount,
        attendanceRecords: presentAttendance,
        attendanceByStatus: attendanceByStatus.map((item) => ({ label: item.status, count: item._count._all })),
        trend: attendanceTrendRows.map((item) => ({ startsAt: item.startsAt.toISOString(), count: item.count })),
        comparison: {
          attendanceRecords: periodComparison(presentAttendance, priorPresentAttendance),
          engagedMembers: periodComparison(engagedMembers, priorEngagedMembers),
          engagementPercent: periodComparison(engagementPercent, priorEngagementPercent),
          eventCount: periodComparison(recentEventCount, priorEventCount)
        }
      },
      volunteerCoverage: {
        windowDays: MEMBERSHIP_DASHBOARD_DATE_WINDOW_DAYS,
        groupCount: volunteerGroups,
        volunteerCount: volunteerRows[0]?.count ?? 0,
        ...volunteerSummary,
        coveragePercent,
        comparison: {
          coveragePercent: periodComparison(coveragePercent, priorCoveragePercent),
          coveredSlots: periodComparison(volunteerSummary.coveredSlots, priorVolunteerSummary.coveredSlots),
          shifts: periodComparison(volunteerSummary.shiftCount, priorVolunteerSummary.shiftCount)
        },
        gaps: volunteerGapRows.map((gap) => ({
          shiftId: gap.id,
          title: gap.title,
          groupName: gap.groupName,
          startsAt: gap.startsAt.toISOString(),
          capacity: gap.capacity,
          assigned: gap.assigned,
          openSlots: Math.max(gap.capacity - gap.assigned, 0)
        }))
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load membership dashboard." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await authorize();
    const layout = normalizeDashboardLayout(await request.json());
    await db.membershipDashboardPreference.upsert({
      where: { userId: user.id },
      create: { churchId: user.churchId!, userId: user.id, configuration: layout },
      update: { configuration: layout }
    });
    return NextResponse.json({ layout });
  } catch {
    return NextResponse.json({ error: "Unable to save dashboard layout." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const user = await authorize();
    await db.membershipDashboardPreference.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ layout: normalizeDashboardLayout(null) });
  } catch {
    return NextResponse.json({ error: "Unable to reset dashboard layout." }, { status: 400 });
  }
}
