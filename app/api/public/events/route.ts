import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isPublicSiteEnabled } from "@/lib/modules";

export async function GET(request: Request) {
  if (!(await isPublicSiteEnabled())) return NextResponse.json({ events: [] });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const startsAt = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const endsAt = to ? new Date(to) : new Date(new Date().getFullYear() + 1, 0, 1);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ error: "Invalid calendar range." }, { status: 400 });
  }
  const events = await db.membershipEvent.findMany({
    where: {
      published: true,
      status: { not: "CANCELLED" },
      startsAt: { lt: endsAt },
      OR: [{ endsAt: { gt: startsAt } }, { endsAt: null }]
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, description: true, eventType: true, category: true, location: true, startsAt: true, endsAt: true, allDay: true }
  });
  return NextResponse.json({ events });
}
