import { NextResponse } from "next/server";
import { ensureEditableFields, listMemberLinkRequests, reviewMemberLinkRequest } from "@/lib/membership-member-links";

export async function GET() {
  try {
    const [requests, fields] = await Promise.all([listMemberLinkRequests(), ensureEditableFields()]);
    return NextResponse.json({ requests, fields });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load membership link requests." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    if (typeof input.fieldKey !== "string" || typeof input.enabled !== "boolean") return NextResponse.json({ error: "Invalid field setting." }, { status: 400 });
    const { db } = await import("@/lib/db");
    const { requirePermission } = await import("@/lib/auth");
    await requirePermission("MANAGE_USERS");
    const field = await db.membershipEditableField.update({ where: { fieldKey: input.fieldKey }, data: { enabled: input.enabled } });
    return NextResponse.json(field);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to update field setting." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    if (typeof input.requestId !== "string" || !["approve", "decline"].includes(input.action)) return NextResponse.json({ error: "Invalid membership link decision." }, { status: 400 });
    return NextResponse.json(await reviewMemberLinkRequest(input.requestId, input.action, input.individualId, input.override === true));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review request." }, { status: 400 });
  }
}
