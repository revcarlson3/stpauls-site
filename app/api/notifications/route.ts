import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canSendToGroup, canSendToUser, MAX_NOTIFICATION_RECIPIENTS } from "@/lib/notifications";

async function isAdminGroup(groupId: string | null) {
  if (!groupId) return false;
  const group = await db.securityGroup.findUnique({ where: { id: groupId }, select: { permissions: { where: { permission: "ACCESS_ADMIN" }, select: { permission: true } } } });
  return Boolean(group?.permissions.length);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const notifications = await db.reportAutomationNotification.findMany({
    where: { userId: user.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: { id: true, title: true, message: true, link: true, category: true, readAt: true, createdAt: true, runId: true, sender: { select: { name: true, email: true } } }
  });
  const hasMore = notifications.length > limit;
  const page = notifications.slice(0, limit);
  const canSend = user.permissions.includes("ACCESS_ADMIN") || Boolean(user.effectiveGroupId);
  const groups = user.permissions.includes("ACCESS_ADMIN")
    ? await db.securityGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  const users = canSend
    ? await db.user.findMany({ where: { isActive: true, ...(user.permissions.includes("ACCESS_ADMIN") ? {} : { OR: [{ groupId: user.effectiveGroupId }, { group: { permissions: { some: { permission: "ACCESS_ADMIN" } } } }] }) }, orderBy: [{ name: "asc" }, { email: "asc" }], select: { id: true, name: true, email: true, groupId: true } })
    : [];
  const unreadCount = await db.reportAutomationNotification.count({ where: { userId: user.id, readAt: null } });
  return NextResponse.json({ notifications: page, unreadCount, hasMore, nextBefore: hasMore ? page[page.length - 1]?.createdAt.toISOString() : null, canSend, groups, users, currentGroupId: user.effectiveGroupId });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.clearUnread === true) {
    await db.reportAutomationNotification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  } else if (typeof body?.id === "string") {
    await db.reportAutomationNotification.updateMany({ where: { id: body.id, userId: user.id }, data: { readAt: new Date() } });
  } else {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.all === true) {
    await db.reportAutomationNotification.deleteMany({ where: { userId: user.id } });
    await logAudit({ activityType: "notification-deleted", summary: "All notifications deleted", actorId: user.id });
  } else if (typeof body?.id === "string") {
    await db.reportAutomationNotification.deleteMany({ where: { id: body.id, userId: user.id } });
    await logAudit({ activityType: "notification-deleted", summary: "Notification deleted", actorId: user.id, details: body.id });
  }
  else return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 160) : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const category = typeof body?.category === "string" ? body.category.trim().slice(0, 40).toUpperCase() : "GENERAL";
  const link = typeof body?.link === "string" ? body.link.trim().slice(0, 500) : "";
  const targetType = body?.targetType;
  if (!title || !message || !["USER", "GROUP", "ADMINS", "GLOBAL"].includes(targetType)) return NextResponse.json({ error: "Title, message, and a valid audience are required." }, { status: 400 });
  if (link && (!link.startsWith("/") || link.startsWith("//"))) return NextResponse.json({ error: "Notification links must be local paths on this site." }, { status: 400 });
  const admin = user.permissions.includes("ACCESS_ADMIN");
  let recipientIds: string[] = [];
  if (targetType === "GLOBAL") {
    if (!admin) return NextResponse.json({ error: "Only administrators can send global notifications." }, { status: 403 });
    if (body?.confirmGlobal !== true) return NextResponse.json({ error: "Global delivery requires explicit confirmation." }, { status: 400 });
    recipientIds = (await db.user.findMany({ where: { isActive: true }, select: { id: true } })).map((item) => item.id);
  } else if (targetType === "ADMINS") {
    recipientIds = (await db.user.findMany({ where: { isActive: true, group: { permissions: { some: { permission: "ACCESS_ADMIN" } } } }, select: { id: true } })).map((item) => item.id);
  } else if (targetType === "GROUP") {
    const groupId = typeof body?.targetId === "string" ? body.targetId : "";
    if (!canSendToGroup({ senderIsAdmin: admin, senderGroupId: user.effectiveGroupId, targetGroupId: groupId })) return NextResponse.json({ error: "You can only send to your own security group." }, { status: 403 });
    recipientIds = (await db.user.findMany({ where: { isActive: true, groupId }, select: { id: true } })).map((item) => item.id);
  } else {
    const targetId = typeof body?.targetId === "string" ? body.targetId : "";
    const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true, groupId: true } });
    if (!target) return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
    if (!canSendToUser({ senderIsAdmin: admin, senderGroupId: user.effectiveGroupId, recipientGroupId: target.groupId, recipientIsAdmin: await isAdminGroup(target.groupId) })) return NextResponse.json({ error: "You can only send to users in your group or administrators." }, { status: 403 });
    recipientIds = [target.id];
  }
  recipientIds = recipientIds.filter((id, index, list) => list.indexOf(id) === index);
  if (recipientIds.length > MAX_NOTIFICATION_RECIPIENTS) return NextResponse.json({ error: `A notification can target at most ${MAX_NOTIFICATION_RECIPIENTS} users at a time.` }, { status: 400 });
  if (!recipientIds.length) return NextResponse.json({ error: "No active recipients matched this audience." }, { status: 400 });
  await db.reportAutomationNotification.createMany({ data: recipientIds.map((userId) => ({ userId, senderId: user.id, title, message, category, link: link || null })) });
  await logAudit({ activityType: "notification-sent", summary: `Notification sent to ${recipientIds.length} user(s)`, actorId: user.id, details: `${category}: ${title}` });
  return NextResponse.json({ sent: recipientIds.length });
}
