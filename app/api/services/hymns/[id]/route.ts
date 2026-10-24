import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";

const RIGHTS = new Set(["UNKNOWN", "PUBLIC_DOMAIN", "COPYRIGHTED"]);

function value(input: unknown, max: number) {
  return typeof input === "string" ? input.trim().slice(0, max) || null : null;
}

function url(input: unknown) {
  const text = value(input, 1000);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const scope = await requireTenantScope();
    const input = await request.json() as Record<string, unknown>;
    const rights = ["lyricsRights", "musicRights", "arrangementRights"] as const;
    const normalizedRights = Object.fromEntries(rights.map((key) => [key, input[key] === undefined ? undefined : String(input[key])])) as Record<typeof rights[number], string | undefined>;
    if (rights.some((key) => normalizedRights[key] !== undefined && !RIGHTS.has(normalizedRights[key] as string))) {
      return NextResponse.json({ error: "Choose valid rights statuses." }, { status: 400 });
    }
    const hymn = await db.worshipHymn.findFirst({ where: { id: params.id, hymnal: { churchId: scope.church.id } }, select: { id: true } });
    if (!hymn) return NextResponse.json({ error: "Hymn not found." }, { status: 404 });
    const updated = await db.worshipHymn.update({
      where: { id: hymn.id },
      data: {
        ...(normalizedRights.lyricsRights !== undefined ? { lyricsRights: normalizedRights.lyricsRights } : {}),
        ...(normalizedRights.musicRights !== undefined ? { musicRights: normalizedRights.musicRights } : {}),
        ...(normalizedRights.arrangementRights !== undefined ? { arrangementRights: normalizedRights.arrangementRights } : {}),
        ...(input.lyricsText !== undefined ? { lyricsText: value(input.lyricsText, 30000) } : {}),
        ...(input.musicImageUrl !== undefined ? { musicImageUrl: url(input.musicImageUrl) } : {}),
        ...(input.musicUrl !== undefined ? { musicUrl: url(input.musicUrl) } : {}),
        ...(input.rightsSourceUrl !== undefined ? { rightsSourceUrl: url(input.rightsSourceUrl) } : {}),
        ...(input.rightsNotes !== undefined ? { rightsNotes: value(input.rightsNotes, 2000) } : {}),
      },
    });
    return NextResponse.json({ hymn: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update hymn rights." }, { status: 400 });
  }
}
