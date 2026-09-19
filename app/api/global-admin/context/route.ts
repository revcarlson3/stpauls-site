import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { logGlobalAdminAction, requireGlobalAdmin, SELECTED_CHURCH_COOKIE } from "@/lib/global-admin";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try { return NextResponse.json({ church: (await requireGlobalAdmin()).church }); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access required." }, { status: 403 }); return NextResponse.json({ error: "Unable to load site context." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const context = await requireGlobalAdmin();
    const input = await request.json().catch(() => ({}));
    const churchId = typeof input.churchId === "string" ? input.churchId : "";
    if (!churchId) {
      cookies().delete(SELECTED_CHURCH_COOKIE);
      if (context.church) {
        await logAudit({
          activityType: "global-admin-context-cleared",
          summary: "Cleared the selected site for bridge administration.",
          actorId: context.user.id,
          details: JSON.stringify({ boundary: "global-admin", selectedChurchId: context.church.id })
        });
      }
      return NextResponse.json({ church: null });
    }
    const church = churchId ? await db.church.findFirst({ where: { id: churchId, status: "ACTIVE" }, select: { id: true, name: true, slug: true } }) : null;
    if (!church) return NextResponse.json({ error: "Select an active site." }, { status: 400 });
    cookies().set(SELECTED_CHURCH_COOKIE, church.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    await logGlobalAdminAction({ activityType: "global-admin-context-selected", summary: "Selected a site for bridge administration.", targetType: "church", targetId: church.id, metadata: { slug: church.slug } });
    return NextResponse.json({ church });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to select site." }, { status: 500 });
  }
}
