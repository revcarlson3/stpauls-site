import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAnnouncementInput } from "@/lib/global-admin-announcements";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    if (!user.churchId) return NextResponse.json({ announcements: [] });
    const announcements = await db.globalAnnouncement.findMany({
      where: { churchId: user.churchId, audience: "TENANT" },
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }],
      select: { id: true, title: true, body: true, severity: true, placement: true, startsAt: true, endsAt: true, isActive: true }
    });
    return NextResponse.json({ announcements });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Unauthorized:") ? "Settings access is required." : "Unable to load announcements." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    if (!user.churchId) return NextResponse.json({ error: "A church membership is required." }, { status: 400 });
    const data = parseAnnouncementInput({ ...(await request.json()), audience: "TENANT", churchId: user.churchId, placement: "AUTHENTICATED" }, { allowTenant: true });
    const announcement = await db.globalAnnouncement.create({ data, select: { id: true } });
    await db.globalAnnouncementDelivery.create({ data: { announcementId: announcement.id, churchId: user.churchId } });
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message.includes("required") || message.startsWith("Invalid") || message.startsWith("The end") ? message : "Unable to create announcement." }, { status: message.startsWith("Unauthorized:") ? 403 : 400 });
  }
}
