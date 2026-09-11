import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

type Snapshot = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "DECEASED" | "REMOVED";
  memberTypeId: string;
  familyRoleId: string;
  removedAt: string | null;
};

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    if (typeof input?.auditId !== "string" || !input.auditId) return NextResponse.json({ error: "A bulk action reference is required." }, { status: 400 });
    const audit = await db.auditLog.findUnique({ where: { id: input.auditId }, select: { id: true, activityType: true, details: true } });
    if (!audit || !audit.details || !["membership-individual-updated", "membership-individual-removed"].includes(audit.activityType)) return NextResponse.json({ error: "The bulk action could not be found." }, { status: 404 });
    const alreadyUndone = await db.auditLog.findFirst({ where: { activityType: "membership-individual-updated", details: { contains: `"sourceAuditId":"${audit.id}"` } }, select: { id: true } });
    if (alreadyUndone) return NextResponse.json({ error: "This bulk action has already been undone." }, { status: 409 });
    let parsed: { kind?: string; before?: Snapshot[] };
    try { parsed = JSON.parse(audit.details) as { kind?: string; before?: Snapshot[] }; } catch { parsed = {}; }
    if (parsed.kind !== "bulk-reversible" || !Array.isArray(parsed.before) || !parsed.before.length) return NextResponse.json({ error: "This bulk action is not reversible." }, { status: 409 });
    const restored = await db.$transaction(async (transaction) => {
      let count = 0;
      for (const snapshot of parsed.before ?? []) {
        const result = await transaction.membershipIndividual.updateMany({
          where: { id: snapshot.id },
          data: { status: snapshot.status, memberTypeId: snapshot.memberTypeId, familyRoleId: snapshot.familyRoleId, removedAt: snapshot.removedAt ? new Date(snapshot.removedAt) : null }
        });
        count += result.count;
      }
      await transaction.auditLog.create({
        data: {
          activityType: "membership-individual-updated",
          summary: `Undid a bulk membership action for ${count} individual${count === 1 ? "" : "s"}.`,
          actorId: user.id,
          details: JSON.stringify({ kind: "bulk-undo", sourceAuditId: audit.id, memberIds: parsed.before?.map((snapshot) => snapshot.id) })
        }
      });
      return count;
    });
    return NextResponse.json({ restored });
  } catch {
    return NextResponse.json({ error: "Unable to undo the bulk membership action." }, { status: 500 });
  }
}
