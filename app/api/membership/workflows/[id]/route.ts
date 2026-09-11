import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const targetType = input?.targetType === "FAMILY" ? "FAMILY" : input?.targetType === "INDIVIDUAL" ? "INDIVIDUAL" : "";
    const steps = Array.isArray(input?.steps) ? input.steps : [];
    if (!name || name.length > 120 || !targetType || !steps.length) return NextResponse.json({ error: "Enter a name, target, and at least one workflow step." }, { status: 400 });
    const workflow = await db.membershipWorkflow.update({
      where: { id: params.id },
      data: { name, targetType, description: typeof input.description === "string" ? input.description.trim() || null : null, steps }
    });
    return NextResponse.json({ workflow });
  } catch {
    return NextResponse.json({ error: "Unable to update workflow." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    await db.membershipWorkflow.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete workflow." }, { status: 400 });
  }
}
