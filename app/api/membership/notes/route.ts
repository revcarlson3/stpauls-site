import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const noteSelect = {
  id: true,
  individualId: true,
  reason: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } }
} as const;

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const individualId = new URL(request.url).searchParams.get("individualId")?.trim();
    if (!individualId) return NextResponse.json({ error: "An individual is required." }, { status: 400 });

    const individual = await db.membershipIndividual.findUnique({
      where: { id: individualId },
      select: { id: true, status: true }
    });
    if (!individual || individual.status === "REMOVED") return NextResponse.json({ error: "Individual not found." }, { status: 404 });

    const notes = await db.membershipNote.findMany({
      where: { individualId },
      orderBy: { createdAt: "desc" },
      select: noteSelect
    });
    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ error: "Unable to load membership notes." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const individualId = typeof input?.individualId === "string" ? input.individualId.trim() : "";
    const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
    const body = typeof input?.body === "string" ? input.body.trim() : "";
    if (!individualId || !reason || !body || reason.length > 120 || body.length > 5000) {
      return NextResponse.json({ error: "A reason and note body are required. Notes must be 5,000 characters or fewer." }, { status: 400 });
    }

    const individual = await db.membershipIndividual.findUnique({
      where: { id: individualId },
      select: { id: true, firstName: true, status: true }
    });
    if (!individual || individual.status === "REMOVED") return NextResponse.json({ error: "Individual not found." }, { status: 404 });

    const note = await db.membershipNote.create({
      data: { individualId, authorId: user.id, reason, body },
      select: noteSelect
    });
    await logAudit({
      activityType: "membership-note-created",
      summary: `Added a membership note for ${individual.firstName}.`,
      details: `Reason: ${reason}.`,
      actorId: user.id
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create membership note." }, { status: 500 });
  }
}
