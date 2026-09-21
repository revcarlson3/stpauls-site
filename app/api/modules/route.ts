import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAvailableModules, isPublicSiteEnabled } from "@/lib/modules";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.canAccessAdmin) return NextResponse.json({ error: "Unable to load modules." }, { status: 403 });
    const [modules, publicSiteEnabled] = await Promise.all([
      getAvailableModules(user.id, user.permissions),
      isPublicSiteEnabled()
    ]);
    return NextResponse.json({ modules, canManageModules: user.permissions.includes("MANAGE_MODULES"), publicSiteEnabled });
  } catch {
    return NextResponse.json({ error: "Unable to load modules." }, { status: 403 });
  }
}
