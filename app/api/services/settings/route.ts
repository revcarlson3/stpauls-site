import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";

const TYPES = new Set(["ONE_YEAR", "THREE_YEAR"]);

async function access() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return requireTenantScope();
}

export async function GET() {
  try {
    const scope = await access();
    const settings = await db.worshipServiceSettings.findUnique({ where: { churchId: scope.church.id }, select: { lectionaryEnabled: true, lectionaryType: true } });
    return NextResponse.json({ lectionaryEnabled: settings?.lectionaryEnabled ?? false, lectionaryType: settings?.lectionaryType ?? "THREE_YEAR" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load service settings." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await access();
    const input = await request.json() as { lectionaryEnabled?: unknown; lectionaryType?: unknown };
    const lectionaryEnabled = input.lectionaryEnabled === true;
    const lectionaryType = typeof input.lectionaryType === "string" && TYPES.has(input.lectionaryType) ? input.lectionaryType : "THREE_YEAR";
    const settings = await db.worshipServiceSettings.upsert({
      where: { churchId: scope.church.id },
      update: { lectionaryEnabled, lectionaryType },
      create: { churchId: scope.church.id, lectionaryEnabled, lectionaryType },
      select: { lectionaryEnabled: true, lectionaryType: true },
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save service settings." }, { status: 400 });
  }
}
