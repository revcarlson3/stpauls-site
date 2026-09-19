import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireGlobalAdmin } from "@/lib/global-admin";

export async function GET() {
  let context;
  try { context = await requireGlobalAdmin({ selectedChurch: true, sensitive: true }); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access, recent MFA, and a selected site are required." }, { status: 403 }); return NextResponse.json({ error: "A selected site is required." }, { status: 409 }); }
  const groups = await db.securityGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json({ groups, activeGroupId: cookies().get("viewAsGroupId")?.value ?? null, selectedChurch: context.church });
}

export async function POST(request: Request) {
  let context;
  try { context = await requireGlobalAdmin({ selectedChurch: true, sensitive: true }); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access, recent MFA, and a selected site are required." }, { status: 403 }); return NextResponse.json({ error: "A selected site is required." }, { status: 409 }); }
  const input = await request.json().catch(() => ({}));
  const groupId = typeof input?.groupId === "string" ? input.groupId : "";
  const response = NextResponse.json({ activeGroupId: groupId || null });
  if (!groupId) {
    response.cookies.delete("viewAsGroupId");
    await logAudit({ activityType: "view-as-changed", summary: "Cleared security-group preview.", actorId: context.user.id, details: JSON.stringify({ boundary: "global-admin", selectedChurchId: context.church?.id, targetType: "security-group", targetId: null }) });
    return response;
  }
  const group = await db.securityGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) return NextResponse.json({ error: "Security group not found." }, { status: 404 });
  response.cookies.set("viewAsGroupId", group.id, { httpOnly: true, sameSite: "lax", path: "/" });
  const selectedGroup = await db.securityGroup.findUnique({ where: { id: group.id }, select: { name: true } });
  await logAudit({ activityType: "view-as-changed", summary: `Started viewing the site as ${selectedGroup?.name ?? "a security group"}.`, details: JSON.stringify({ boundary: "global-admin", selectedChurchId: context.church?.id, targetType: "security-group", targetId: group.id }), actorId: context.user.id });
  return response;
}
