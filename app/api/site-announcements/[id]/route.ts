import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAnnouncementInput } from "@/lib/global-admin-announcements";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    if (!user.churchId) throw new Error("Unauthorized: a church membership is required.");
    const existing = await db.globalAnnouncement.findFirst({ where: { id: params.id, churchId: user.churchId, audience: "TENANT" }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    const data = parseAnnouncementInput({ ...(await request.json()), audience: "TENANT", churchId: user.churchId, placement: "AUTHENTICATED" }, { allowTenant: true });
    return NextResponse.json({ announcement: await db.globalAnnouncement.update({ where: { id: params.id }, data, select: { id: true } }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message.includes("required") || message.startsWith("Invalid") || message.startsWith("The end") ? message : "Unable to update announcement." }, { status: message.startsWith("Unauthorized:") ? 403 : 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    if (!user.churchId) throw new Error("Unauthorized: a church membership is required.");
    const deleted = await db.globalAnnouncement.deleteMany({ where: { id: params.id, churchId: user.churchId, audience: "TENANT" } });
    return deleted.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to delete announcement." }, { status: 403 });
  }
}
