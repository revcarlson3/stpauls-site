import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPermission, requirePermission } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    const [settings, church] = await Promise.all([
      db.securitySettings.findUnique({ where: { id: 1 }, select: { publicSiteEnabled: true, maintenanceMode: true } }),
      user.churchId ? db.church.findUnique({ where: { id: user.churchId }, select: { publicSiteEnabled: true, maintenanceMode: true } }) : Promise.resolve(null)
    ]);
    return NextResponse.json({
      publicSiteEnabled: church?.publicSiteEnabled ?? settings?.publicSiteEnabled ?? true,
      maintenanceMode: church?.maintenanceMode ?? settings?.maintenanceMode ?? false,
      canManageModules: user.permissions.includes("MANAGE_MODULES")
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load website settings.");
  }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  if (!input || typeof input.publicSiteEnabled !== "boolean" || typeof input.maintenanceMode !== "boolean") {
    return NextResponse.json({ error: "Invalid website settings." }, { status: 400 });
  }
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    if (!(await hasPermission(user.id, "MANAGE_MODULES"))) return NextResponse.json({ error: "Manage Modules permission is required." }, { status: 403 });
    await db.securitySettings.upsert({
      where: { id: 1 },
      update: { publicSiteEnabled: input.publicSiteEnabled, maintenanceMode: input.maintenanceMode },
      create: { id: 1, publicSiteEnabled: input.publicSiteEnabled, maintenanceMode: input.maintenanceMode }
    });
    if (user.churchId) {
      await db.church.update({ where: { id: user.churchId }, data: { publicSiteEnabled: input.publicSiteEnabled, maintenanceMode: input.maintenanceMode } });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save website settings.");
  }
}
