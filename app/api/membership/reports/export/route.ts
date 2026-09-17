import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const reports = await db.membershipReport.findMany({ where: { scope: "MEMBERSHIP", OR: [{ createdById: user.id }, { visibility: "MEMBERSHIP_MANAGERS" }] }, orderBy: { name: "asc" } });
    return new NextResponse(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), reports }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=membership-reports.json" } });
  } catch {
    return NextResponse.json({ error: "Unable to export reports." }, { status: 403 });
  }
}
