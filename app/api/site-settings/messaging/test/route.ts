import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { sendMembershipEmail, sendSmsText } from "@/lib/membership-delivery";

export async function POST(request: Request) {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const input = await request.json();
    const channel = input?.channel;
    const recipient = typeof input?.recipient === "string" ? input.recipient.trim() : "";
    if (!recipient || !["EMAIL", "SMS"].includes(channel)) {
      return NextResponse.json({ error: "Choose a valid test recipient and channel." }, { status: 400 });
    }
    if (channel === "EMAIL") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return NextResponse.json({ error: "Enter a valid test email address." }, { status: 400 });
      await sendMembershipEmail({
        recipient,
        subject: "St. Paul's messaging test",
        bodyHtml: "<p>This is a test message from St. Paul's site messaging settings.</p>",
        bodyText: "This is a test message from St. Paul's site messaging settings.",
        attachments: []
      });
    } else {
      if (!/^\+?[0-9 ()-]{7,}$/.test(recipient)) return NextResponse.json({ error: "Enter a valid test phone number." }, { status: 400 });
      await sendSmsText(recipient, "This is a test message from St. Paul's site messaging settings.");
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send the test message." }, { status: 502 });
  }
}
