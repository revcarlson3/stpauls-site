import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";

function dateParam(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setHours(23, 59, 59, 999);
  return date;
}

export async function GET(request: Request) {
  try {
    await authorizeVolunteerScheduling();
    const url = new URL(request.url);
    const dateFrom = dateParam(url.searchParams.get("dateFrom"));
    const dateTo = dateParam(url.searchParams.get("dateTo"));
    if (dateFrom === null || dateTo === null) return NextResponse.json({ error: "Use valid dateFrom and dateTo values." }, { status: 400 });
    const eventId = url.searchParams.get("eventId")?.trim();
    const groupId = url.searchParams.get("groupId")?.trim();
    const memberId = url.searchParams.get("memberId")?.trim();
    const records = await db.membershipAttendanceRecord.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(memberId ? { individualId: memberId } : {}),
        ...(dateFrom || dateTo ? { event: { startsAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } } : {}),
        ...(groupId ? { individual: { volunteerGroups: { some: { groupId } } } } : {})
      },
      select: {
        status: true,
        event: { select: { id: true, title: true, startsAt: true } },
        individual: { select: { id: true, firstName: true, lastName: true, family: { select: { lastName: true } }, volunteerGroups: { select: { groupId: true, group: { select: { name: true } } } } } }
      },
      orderBy: { event: { startsAt: "asc" } },
      take: 10000
    });
    const totals = { PRESENT: 0, ABSENT: 0, EXCUSED: 0 };
    const byEvent = new Map<string, { eventId: string; title: string; date: string; present: number; absent: number; excused: number }>();
    const byDate = new Map<string, { date: string; present: number; absent: number; excused: number }>();
    const byGroup = groupId ? undefined : new Map<string, { groupId: string; name: string; present: number; absent: number; excused: number }>();
    const byMember = new Map<string, { memberId: string; name: string; present: number; absent: number; excused: number }>();
    for (const record of records) {
      const status = record.status.toLowerCase() as "present" | "absent" | "excused";
      totals[record.status] += 1;
      const date = record.event.startsAt.toISOString().slice(0, 10);
      const event = byEvent.get(record.event.id) ?? { eventId: record.event.id, title: record.event.title, date, present: 0, absent: 0, excused: 0 };
      event[status] += 1; byEvent.set(record.event.id, event);
      const day = byDate.get(date) ?? { date, present: 0, absent: 0, excused: 0 };
      day[status] += 1; byDate.set(date, day);
      const name = `${record.individual.firstName} ${record.individual.lastName ?? record.individual.family.lastName}`;
      const member = byMember.get(record.individual.id) ?? { memberId: record.individual.id, name, present: 0, absent: 0, excused: 0 };
      member[status] += 1; byMember.set(record.individual.id, member);
      if (byGroup) for (const membership of record.individual.volunteerGroups) {
        const group = byGroup.get(membership.groupId) ?? { groupId: membership.groupId, name: membership.group.name, present: 0, absent: 0, excused: 0 };
        group[status] += 1; byGroup.set(membership.groupId, group);
      }
    }
    if (groupId) {
      const group = await db.membershipVolunteerGroup.findUnique({ where: { id: groupId }, select: { name: true } });
      return NextResponse.json({ filters: { eventId: eventId ?? null, dateFrom: dateFrom?.toISOString() ?? null, dateTo: dateTo?.toISOString() ?? null, groupId, memberId: memberId ?? null }, totals, byEvent: Array.from(byEvent.values()), byDate: Array.from(byDate.values()), byGroup: group ? [{ groupId, name: group.name, ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key.toLowerCase(), value])) }] : [], byMember: Array.from(byMember.values()) });
    }
    return NextResponse.json({ filters: { eventId: eventId ?? null, dateFrom: dateFrom?.toISOString() ?? null, dateTo: dateTo?.toISOString() ?? null, groupId: null, memberId: memberId ?? null }, totals, byEvent: Array.from(byEvent.values()), byDate: Array.from(byDate.values()), byGroup: byGroup ? Array.from(byGroup.values()) : [], byMember: Array.from(byMember.values()) });
  } catch {
    return NextResponse.json({ error: "Unable to load attendance summary." }, { status: 403 });
  }
}
