import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canAccessAdmin } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const groups = await db.securityGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, permissions: { select: { permission: true } } } });
  return NextResponse.json({ groups: groups.map((group) => ({ id: group.id, name: group.name, canAccessAdmin: canAccessAdmin(group.permissions.map((permission) => permission.permission)) })), activeGroupId: cookies().get("viewAsGroupId")?.value ?? null });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const input = await request.json().catch(() => ({}));
  const groupId = typeof input?.groupId === "string" ? input.groupId : "";
  const response = NextResponse.json({ activeGroupId: groupId || null });
  if (!groupId) {
    response.cookies.delete("viewAsGroupId");
    await logAudit({ activityType: "view-as-changed", summary: "Cleared security-group preview.", actorId: user.id });
    return response;
  }
  const group = await db.securityGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) return NextResponse.json({ error: "Security group not found." }, { status: 404 });
  response.cookies.set("viewAsGroupId", group.id, { httpOnly: true, sameSite: "lax", path: "/" });
  const selectedGroup = await db.securityGroup.findUnique({ where: { id: group.id }, select: { name: true } });
  await logAudit({ activityType: "view-as-changed", summary: `Started viewing the site as ${selectedGroup?.name ?? "a security group"}.`, details: JSON.stringify({ groupId: group.id }), actorId: user.id });
  return response;
}
