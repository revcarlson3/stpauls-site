import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { logAudit } from "@/lib/audit";
import { advanceMembershipGrades } from "@/lib/membership-grade-advancement";

export async function POST() {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const result = await advanceMembershipGrades();
    if (!result.alreadyRun) await logAudit({ activityType: "membership-individual-updated", summary: `Advanced ${result.updated} membership grade level${result.updated === 1 ? "" : "s"}.`, actorId: user.id });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unable to advance grade levels." }, { status: 500 });
  }
}
