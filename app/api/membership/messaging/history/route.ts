import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const messageId = new URL(request.url).searchParams.get("messageId")?.trim();
    const messages = await db.membershipMessage.findMany({
      where: messageId ? { id: messageId } : undefined,
      orderBy: { createdAt: "desc" },
      take: messageId ? 1 : 20,
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
    return NextResponse.json(messages);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load message history." }, { status: 500 });
  }
}
