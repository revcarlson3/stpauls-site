import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";

const TYPES = new Set(["ONE_YEAR", "THREE_YEAR"]);
const STREAMING_DESTINATIONS = new Set(["YOUTUBE", "FACEBOOK", "VIMEO", "TWITCH", "LINKEDIN", "RESTREAM"]);

async function access() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return requireTenantScope();
}

export async function GET() {
  try {
    const scope = await access();
    const settings = await db.worshipServiceSettings.findUnique({ where: { churchId: scope.church.id }, select: { lectionaryEnabled: true, lectionaryType: true, streamingDestinations: true } });
    const streamingDestinations = Array.isArray(settings?.streamingDestinations) ? settings.streamingDestinations.filter((value): value is string => typeof value === "string" && STREAMING_DESTINATIONS.has(value)) : [];
    return NextResponse.json({ lectionaryEnabled: settings?.lectionaryEnabled ?? false, lectionaryType: settings?.lectionaryType ?? "THREE_YEAR", streamingDestinations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load service settings." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await access();
    const input = await request.json() as { lectionaryEnabled?: unknown; lectionaryType?: unknown; streamingDestinations?: unknown };
    const update: { lectionaryEnabled?: boolean; lectionaryType?: string; streamingDestinations?: string[] } = {};
    const create: { lectionaryEnabled?: boolean; lectionaryType?: string; streamingDestinations?: string[] } = {};
    if ("lectionaryEnabled" in input) {
      if (typeof input.lectionaryEnabled !== "boolean") return NextResponse.json({ error: "Choose whether the lectionary is enabled." }, { status: 400 });
      update.lectionaryEnabled = input.lectionaryEnabled;
      create.lectionaryEnabled = input.lectionaryEnabled;
    }
    if ("lectionaryType" in input) {
      if (typeof input.lectionaryType !== "string" || !TYPES.has(input.lectionaryType)) return NextResponse.json({ error: "Choose a valid lectionary type." }, { status: 400 });
      update.lectionaryType = input.lectionaryType;
      create.lectionaryType = input.lectionaryType;
    }
    if ("streamingDestinations" in input) {
      if (!Array.isArray(input.streamingDestinations) || input.streamingDestinations.length > 6 || input.streamingDestinations.some((value) => typeof value !== "string" || !STREAMING_DESTINATIONS.has(value))) return NextResponse.json({ error: "Choose valid streaming destinations." }, { status: 400 });
      const destinations = Array.from(new Set(input.streamingDestinations));
      update.streamingDestinations = destinations;
      create.streamingDestinations = destinations;
    }
    const settings = await db.worshipServiceSettings.upsert({
      where: { churchId: scope.church.id },
      update,
      create: { churchId: scope.church.id, ...create },
      select: { lectionaryEnabled: true, lectionaryType: true, streamingDestinations: true },
    });
    return NextResponse.json({ settings: { ...settings, streamingDestinations: Array.isArray(settings.streamingDestinations) ? settings.streamingDestinations : [] } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save service settings." }, { status: 400 });
  }
}
