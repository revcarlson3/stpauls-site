import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
}

export async function GET() {
  try {
    const scope = await authorize(); const tenant = await requireTenantScope();
    const workflows = await db.membershipWorkflow.findMany({ where: { churchId: tenant.church.id, isActive: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ workflows });
  } catch {
    return NextResponse.json({ error: "Unable to load workflows." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize(); const tenant = await requireTenantScope();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const targetType = input?.targetType === "FAMILY" ? "FAMILY" : input?.targetType === "INDIVIDUAL" ? "INDIVIDUAL" : "";
    const steps = Array.isArray(input?.steps) ? input.steps : [];
    if (!name || name.length > 120 || !targetType || !steps.length) return NextResponse.json({ error: "Enter a name, target, and at least one workflow step." }, { status: 400 });
    const workflow = await db.membershipWorkflow.create({ data: { churchId: tenant.church.id, name, targetType, description: typeof input.description === "string" ? input.description.trim() || null : null, steps } });
    return NextResponse.json({ workflow }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to save workflow." }, { status: 400 });
  }
}
