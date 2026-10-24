import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";
import { importHymnal, listHymnals } from "@/lib/hymnary";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const scope = await requireTenantScope();
    const [hymnals, settings] = await Promise.all([
      listHymnals(),
      db.worshipServiceSettings.findUnique({ where: { churchId: scope.church.id }, include: { primaryHymnal: { select: { id: true, code: true, name: true, importedAt: true, _count: { select: { hymns: true } } } } } }),
    ]);
    return NextResponse.json({ hymnals, primaryHymnal: settings?.primaryHymnal ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load hymnals." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const scope = await requireTenantScope();
    const input = await request.json() as { code?: unknown; name?: unknown };
    const code = typeof input.code === "string" ? input.code.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!code) return NextResponse.json({ error: "Choose a hymnal." }, { status: 400 });
    const imported = await importHymnal(code, name);
    const result = await db.$transaction(async (transaction) => {
      await transaction.worshipServiceSettings.updateMany({ where: { churchId: scope.church.id }, data: { primaryHymnalId: null } });
      await transaction.worshipHymnal.deleteMany({ where: { churchId: scope.church.id } });
      const hymnal = await transaction.worshipHymnal.create({ data: { churchId: scope.church.id, code: imported.code, name: imported.name, sourceUrl: imported.sourceUrl, hymns: { create: imported.hymns.map((hymn) => ({ number: hymn.number, title: hymn.title, firstLine: hymn.firstLine, tuneName: hymn.tuneName, tuneAuthors: hymn.tuneAuthors, textAuthors: hymn.textAuthors, copyrightInfo: hymn.copyrightInfo, sourceUrl: hymn.sourceUrl })) } }, select: { id: true, code: true, name: true, importedAt: true, _count: { select: { hymns: true } } } });
      await transaction.worshipServiceSettings.upsert({ where: { churchId: scope.church.id }, update: { primaryHymnalId: hymnal.id }, create: { churchId: scope.church.id, primaryHymnalId: hymnal.id } });
      return hymnal;
    });
    return NextResponse.json({ primaryHymnal: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import hymnal data." }, { status: 400 });
  }
}
