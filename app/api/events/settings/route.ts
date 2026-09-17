import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

const defaults = { eventTypes: ["Worship", "Class", "Fellowship", "Outreach", "Meeting", "Other"], categories: [], locations: ["Church campus", "Sanctuary", "Fellowship hall", "Off-site"], timeZone: "America/Chicago" };
async function authorize() {
  const user = await requirePermission("MANAGE_EVENTS");
  await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
  return user;
}
function cleanList(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 100)))).slice(0, 100) : fallback;
}
export async function GET() {
  try {
    await authorize();
    const settings = await db.membershipEventSettings.findUnique({ where: { id: 1 } });
    const usedTypes = await db.membershipEvent.findMany({ distinct: ["eventType"], select: { eventType: true } });
    const eventTypes = cleanList(settings?.eventTypes, defaults.eventTypes);
    if (eventTypes.length === 0) eventTypes.push(...defaults.eventTypes);
    for (const event of usedTypes) if (!eventTypes.includes(event.eventType)) eventTypes.push(event.eventType);
    return NextResponse.json({ settings: { eventTypes, categories: cleanList(settings?.categories, defaults.categories), locations: cleanList(settings?.locations, defaults.locations), timeZone: settings?.timeZone || defaults.timeZone } });
  } catch { return NextResponse.json({ error: "Unable to load event settings." }, { status: 403 }); }
}
export async function PUT(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const currentTypes = await db.membershipEvent.findMany({ distinct: ["eventType"], select: { eventType: true } });
    const eventTypes = cleanList(input?.eventTypes, defaults.eventTypes);
    if (eventTypes.length === 0) return NextResponse.json({ error: "Keep at least one event type." }, { status: 400 });
    const removedType = currentTypes.find((event) => !eventTypes.includes(event.eventType));
    if (removedType) return NextResponse.json({ error: `The event type "${removedType.eventType}" is still used by events and cannot be deleted.` }, { status: 409 });
    const timeZone = typeof input?.timeZone === "string" && input.timeZone.trim() ? input.timeZone.trim().slice(0, 100) : defaults.timeZone;
    Intl.DateTimeFormat("en-US", { timeZone }).format();
    const settings = await db.membershipEventSettings.upsert({ where: { id: 1 }, update: { eventTypes, categories: cleanList(input?.categories, defaults.categories), locations: cleanList(input?.locations, defaults.locations), timeZone }, create: { id: 1, eventTypes, categories: cleanList(input?.categories, defaults.categories), locations: cleanList(input?.locations, defaults.locations), timeZone } });
    return NextResponse.json({ settings });
  } catch { return NextResponse.json({ error: "Unable to save event settings." }, { status: 400 }); }
}
