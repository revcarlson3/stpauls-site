import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
    const body = typeof input?.body === "string" ? input.body.trim() : "";
    if (!reason || !body || reason.length > 120 || body.length > 5000) {
      return NextResponse.json({ error: "A reason and note body are required. Notes must be 5,000 characters or fewer." }, { status: 400 });
    }

    const existing = await db.membershipNote.findUnique({
      where: { id: params.id },
      select: { id: true, individual: { select: { firstName: true, status: true } } }
    });
    if (!existing || existing.individual.status === "REMOVED") return NextResponse.json({ error: "Membership note not found." }, { status: 404 });

    const note = await db.membershipNote.update({
      where: { id: params.id },
      data: { reason, body },
      select: {
        id: true,
        individualId: true,
        reason: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true } }
      }
    });
    await logAudit({
      activityType: "membership-note-updated",
      summary: `Updated a membership note for ${existing.individual.firstName}.`,
      details: `Reason: ${reason}.`,
      actorId: user.id
    });
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "Unable to update membership note." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const existing = await db.membershipNote.findUnique({
      where: { id: params.id },
      select: { id: true, reason: true, individual: { select: { firstName: true } } }
    });
    if (!existing) return NextResponse.json({ error: "Membership note not found." }, { status: 404 });

    await db.membershipNote.delete({ where: { id: params.id } });
    await logAudit({
      activityType: "membership-note-deleted",
      summary: `Deleted a membership note for ${existing.individual.firstName}.`,
      details: `Reason: ${existing.reason}.`,
      actorId: user.id
    });
    return NextResponse.json({ removed: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete membership note." }, { status: 500 });
  }
}
