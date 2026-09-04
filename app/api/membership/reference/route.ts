import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const [roles, types] = await Promise.all([
      db.membershipFamilyRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.membershipMemberType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    ]);
    return NextResponse.json({ roles, types });
  } catch {
    return NextResponse.json({ error: "Unable to load membership reference data." }, { status: 403 });
  }
}
