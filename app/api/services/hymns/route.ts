import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const scope = await requireTenantScope();
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
    const settings = await db.worshipServiceSettings.findUnique({ where: { churchId: scope.church.id }, select: { primaryHymnalId: true } });
    if (!settings?.primaryHymnalId || query.length < 1) return NextResponse.json({ hymns: [] });
    const hymns = await db.worshipHymn.findMany({ where: { hymnalId: settings.primaryHymnalId, OR: [{ number: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }, { firstLine: { contains: query, mode: "insensitive" } }, { tuneName: { contains: query, mode: "insensitive" } }] }, orderBy: [{ number: "asc" }, { title: "asc" }], take: 20 });
    return NextResponse.json({ hymns });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search saved hymns." }, { status: 400 });
  }
}
