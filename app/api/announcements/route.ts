import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const isPublic = new URL(request.url).searchParams.get("surface") === "public";
  const surface = isPublic ? "PUBLIC_TICKER" : "AUTHENTICATED";
  const user = await getCurrentUser();
  if (!isPublic && !user?.churchId) return NextResponse.json({ announcements: [] });
  const now = new Date();
  const announcements = await db.globalAnnouncement.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      placement: { in: isPublic ? ["PUBLIC_TICKER", "BOTH"] : ["AUTHENTICATED", "BOTH"] },
      ...(isPublic
        ? { audience: "GLOBAL" }
        : { OR: [{ audience: "GLOBAL", deliveries: { some: { churchId: user!.churchId! } } }, { audience: "TENANT", churchId: user!.churchId! }] })
    },
    orderBy: [{ severity: "desc" }, { startsAt: "desc" }],
    take: 10,
    select: {
      id: true,
      title: true,
      body: true,
      severity: true,
      audience: true,
      placement: true,
      deliveries: user?.churchId ? { where: { churchId: user.churchId }, select: { acknowledgedAt: true } } : undefined
    }
  });
  return NextResponse.json({ announcements: announcements.map((announcement) => ({ ...announcement, acknowledged: Boolean(announcement.deliveries[0]?.acknowledgedAt) })) });
}
