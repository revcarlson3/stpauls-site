import { NextResponse } from "next/server";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getAvailableModules, isPublicSiteEnabled } from "@/lib/modules";

export async function GET() {
  try {
    const user = await requirePermission("ACCESS_ADMIN");
    const [modules, canManageModules, publicSiteEnabled] = await Promise.all([
      getAvailableModules(user.id),
      hasPermission(user.id, "MANAGE_MODULES"),
      isPublicSiteEnabled()
    ]);
    return NextResponse.json({ modules, canManageModules, publicSiteEnabled });
  } catch {
    return NextResponse.json({ error: "Unable to load modules." }, { status: 403 });
  }
}
