import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user?.churchId) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const announcement = await db.globalAnnouncement.findFirst({
    where: {
      id: params.id,
      isActive: true,
      OR: [{ audience: "TENANT", churchId: user.churchId }, { audience: "GLOBAL", deliveries: { some: { churchId: user.churchId } } }]
    },
    select: { id: true }
  });
  if (!announcement) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  await db.globalAnnouncementDelivery.upsert({
    where: { announcementId_churchId: { announcementId: announcement.id, churchId: user.churchId } },
    create: { announcementId: announcement.id, churchId: user.churchId, acknowledgedAt: new Date() },
    update: { acknowledgedAt: new Date() }
  });
  return NextResponse.json({ acknowledged: true });
}
