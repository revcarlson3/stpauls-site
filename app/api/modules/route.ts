import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvailableModules, isPublicSiteEnabled } from "@/lib/modules";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.canAccessAdmin) return NextResponse.json({ error: "Unable to load modules." }, { status: 403 });
    const subscriptionActive = user.churchId
      ? Boolean(await db.subscription.findFirst({ where: { churchId: user.churchId, status: "ACTIVE" }, select: { id: true } }))
      : false;
    const [modules, publicSiteEnabled] = await Promise.all([
      subscriptionActive ? getAvailableModules(user.id, user.permissions) : Promise.resolve([]),
      isPublicSiteEnabled()
    ]);
    return NextResponse.json({ modules, canManageModules: user.permissions.includes("MANAGE_MODULES"), publicSiteEnabled });
  } catch {
    return NextResponse.json({ error: "Unable to load modules." }, { status: 403 });
  }
}
