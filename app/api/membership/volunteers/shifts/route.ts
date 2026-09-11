import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { logAudit } from "@/lib/audit";
import { MembershipVolunteerInputError, SERVICE_SHIFT_STATUSES, normalizeServiceShiftInput } from "@/lib/membership-volunteers";

async function authorize() {
  return authorizeVolunteerScheduling();
}

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const select = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  capacity: true,
  notes: true,
  opportunity: { select: { id: true, title: true, location: true, defaultRole: true, group: { select: { id: true, name: true } }, eventTeams: { select: { groupId: true, volunteersNeeded: true, group: { select: { id: true, name: true } } } } } },
  _count: { select: { assignments: true } }
} as const;

export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const page = positiveInteger(url.searchParams.get("page"), 1, 100000);
    const pageSize = positiveInteger(url.searchParams.get("pageSize"), 50, 100);
    const status = url.searchParams.get("status")?.trim() ?? "all";
    if (status !== "all" && !SERVICE_SHIFT_STATUSES.includes(status as (typeof SERVICE_SHIFT_STATUSES)[number])) {
      return NextResponse.json({ error: "Choose a valid event status." }, { status: 400 });
    }
    const opportunityId = url.searchParams.get("opportunityId")?.trim();
    const where = {
      ...(status !== "all" ? { status: status as (typeof SERVICE_SHIFT_STATUSES)[number] } : {}),
      ...(opportunityId ? { opportunityId } : {})
    };
    const [shifts, total] = await Promise.all([
      db.membershipServiceShift.findMany({ where, orderBy: [{ startsAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize, select }),
      db.membershipServiceShift.count({ where })
    ]);
    const ids = shifts.map((shift) => shift.id);
    const grouped = ids.length ? await db.membershipServiceRecord.groupBy({ by: ["outcome"], where: { assignment: { shiftId: { in: ids } } }, _count: { _all: true } }) : [];
    const outcomes = Object.fromEntries(grouped.map((row) => [row.outcome, row._count._all]));
    return NextResponse.json({ shifts, outcomes, pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } });
  } catch {
    return NextResponse.json({ error: "Unable to load scheduled events." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const data = normalizeServiceShiftInput(await request.json());
    const opportunity = await db.membershipServiceOpportunity.findUnique({ where: { id: data.opportunityId }, select: { id: true, title: true, isActive: true, eventTeams: { select: { volunteersNeeded: true } } } });
    if (!opportunity) return NextResponse.json({ error: "Service opportunity not found." }, { status: 404 });
    if (!opportunity.isActive) return NextResponse.json({ error: "Inactive events cannot receive new dates." }, { status: 409 });
    const derivedCapacity = opportunity.eventTeams.length ? opportunity.eventTeams.reduce((total, team) => total + team.volunteersNeeded, 0) : null;
    const shift = await db.membershipServiceShift.create({
      data: { ...data, capacity: data.capacity ?? derivedCapacity, opportunityId: data.opportunityId!, startsAt: data.startsAt!, createdById: user.id },
      select
    });
    await logAudit({ activityType: "membership-service-shift-created", summary: `Scheduled an event date for “${opportunity.title}”.`, details: JSON.stringify({ shiftId: shift.id, opportunityId: opportunity.id }), actorId: user.id });
    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    if (error instanceof MembershipVolunteerInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to schedule this event." }, { status: 500 });
  }
}
