import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const params = new URL(request.url).searchParams;
    const messageId = params.get("messageId")?.trim();
    const requestedPage = Number.parseInt(params.get("page") ?? "", 10);
    const paginated = !messageId && Number.isFinite(requestedPage) && requestedPage > 0;
    const page = paginated ? requestedPage : 1;
    const where = messageId ? { id: messageId } : undefined;
    const total = paginated ? await db.membershipMessage.count({ where }) : 0;
    const messages = await db.membershipMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paginated ? (page - 1) * 10 : 0,
      take: paginated ? 10 : messageId ? 1 : 20,
      select: {
        id: true,
        channel: true,
        subject: true,
        status: true,
        deliveryNote: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        recipients: { select: { id: true, displayName: true, address: true, status: true, deliveredAt: true, attemptCount: true, lastAttemptAt: true, failureReason: true, deliveryAttempts: { orderBy: { attemptedAt: "desc" }, take: 10, select: { status: true, error: true, attemptedAt: true, providerMessageId: true } } } }
      }
    });
    return NextResponse.json(messages, {
      headers: paginated ? {
        "X-Message-History-Page": String(page),
        "X-Message-History-Page-Size": "10",
        "X-Message-History-Total": String(total),
        "X-Message-History-Total-Pages": String(Math.max(1, Math.ceil(total / 10)))
      } : undefined
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load message history." }, { status: 500 });
  }
}
