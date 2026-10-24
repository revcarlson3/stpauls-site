import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";
import { DEFAULT_EVENT_TYPES, resolveEventType } from "@/lib/event-validation";
import { BIBLE_BOOKS, LSB_LITURGIES, formatLessonReference, safeVideoUrl, type WorshipServiceHymnInput, type WorshipServiceLessonInput } from "@/lib/worship-service";

const include = {
  clergy: { orderBy: { sortOrder: "asc" as const }, include: { clergy: { select: { id: true, title: true, firstName: true, lastName: true } } } },
  hymns: { orderBy: { sortOrder: "asc" as const }, include: { hymn: true } },
  lessons: { orderBy: { sortOrder: "asc" as const } },
  calendarEvent: { select: { id: true, eventType: true, category: true, location: true } },
} as const;

const serviceStorage = path.join(process.cwd(), "storage", "services", "worship");
const fileExtension = (file: File, kind: "bulletin" | "image") => {
  const extensions: Record<string, string> = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
  if (kind === "bulletin" && file.type !== "application/pdf") return null;
  if (kind === "image" && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return null;
  return extensions[file.type] ?? null;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown, min = 1, max = 999) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function validateLessons(value: unknown): WorshipServiceLessonInput[] | null {
  if (!Array.isArray(value) || value.length > 30) return null;
  const lessons: WorshipServiceLessonInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Record<string, unknown>;
    const book = text(raw.book, 40);
    const startChapter = integer(raw.startChapter);
    const startVerse = raw.startVerse === "" || raw.startVerse == null ? undefined : integer(raw.startVerse);
    const endChapter = raw.endChapter === "" || raw.endChapter == null ? undefined : integer(raw.endChapter);
    const endVerse = raw.endVerse === "" || raw.endVerse == null ? undefined : integer(raw.endVerse);
    if (!BIBLE_BOOKS.includes(book as typeof BIBLE_BOOKS[number]) || !startChapter || (raw.startVerse != null && raw.startVerse !== "" && !startVerse) || (raw.endChapter != null && raw.endChapter !== "" && !endChapter) || (raw.endVerse != null && raw.endVerse !== "" && !endVerse)) return null;
    lessons.push({ book, startChapter, startVerse: startVerse ?? undefined, endChapter: endChapter ?? undefined, endVerse: endVerse ?? undefined, reference: formatLessonReference({ book, startChapter, startVerse: startVerse ?? undefined, endChapter: endChapter ?? undefined, endVerse: endVerse ?? undefined }) });
  }
  return lessons;
}

function validateHymns(value: unknown): WorshipServiceHymnInput[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const hymns: WorshipServiceHymnInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Record<string, unknown>;
    const hymnId = text(raw.hymnId, 80);
    const custom = raw.custom === true || !hymnId;
    const title = text(raw.title, 200);
    if (custom && !title) return null;
    let sourceUrl: string | undefined;
    if (raw.sourceUrl != null && raw.sourceUrl !== "") {
      try {
        const parsed = new URL(String(raw.sourceUrl));
        if (!["http:", "https:"].includes(parsed.protocol)) return null;
        sourceUrl = parsed.toString();
      } catch {
        return null;
      }
    }
    hymns.push({ hymnId: hymnId || undefined, custom, number: text(raw.number, 30) || undefined, title: title || undefined, sourceUrl });
  }
  return hymns;
}

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const scope = await requireTenantScope();
    const services = await db.worshipService.findMany({ where: { churchId: scope.church.id }, orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }], include });
    return NextResponse.json({ services });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load worship services." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const writtenFiles: string[] = [];
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const scope = await requireTenantScope();
    const form = await request.formData();
    const payload = parseJson<Record<string, unknown>>(form.get("payload"), {});
    const title = text(payload.title, 160);
    const startsAt = typeof payload.startsAt === "string" ? new Date(payload.startsAt) : new Date("invalid");
    const endsAt = typeof payload.endsAt === "string" && payload.endsAt ? new Date(payload.endsAt) : null;
    const scheduledAt = typeof payload.scheduledAt === "string" && payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    const liturgy = text(payload.liturgy, 120);
    const status = payload.status === "PUBLISHED" || payload.status === "CANCELLED" ? payload.status : "DRAFT";
    const clergyIds = Array.isArray(payload.clergyIds) ? payload.clergyIds.filter((id): id is string => typeof id === "string").slice(0, 30) : [];
    const hymns = validateHymns(payload.hymns);
    const lessons = validateLessons(payload.lessons);
    const videoUrl = safeVideoUrl(payload.videoUrl);
    if (!title || Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < startsAt)) || (scheduledAt && Number.isNaN(scheduledAt.getTime())) || (liturgy && !LSB_LITURGIES.includes(liturgy as typeof LSB_LITURGIES[number])) || !hymns || !lessons || (payload.videoUrl && videoUrl === undefined)) return NextResponse.json({ error: "Enter valid worship service details." }, { status: 400 });
    const clergy = clergyIds.length ? await db.clergyProfile.findMany({ where: { churchId: scope.church.id, id: { in: clergyIds }, status: "ACTIVE" }, select: { id: true } }) : [];
    if (clergy.length !== clergyIds.length) return NextResponse.json({ error: "One or more selected clergy profiles are unavailable." }, { status: 400 });
    const addToCalendar = payload.addToCalendar === true;
    let eventId: string | null = null;
    if (addToCalendar) {
      if (!user.permissions.includes("MANAGE_EVENTS")) return NextResponse.json({ error: "Event management permission is required to add a service to the calendar." }, { status: 403 });
      await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    }
    const hymnalSettings = await db.worshipServiceSettings.findUnique({ where: { churchId: scope.church.id }, select: { primaryHymnalId: true } });
    const selectedHymnIds = hymns.filter((hymn) => hymn.hymnId).map((hymn) => hymn.hymnId as string);
    const savedHymns = selectedHymnIds.length && hymnalSettings?.primaryHymnalId
      ? await db.worshipHymn.findMany({ where: { id: { in: selectedHymnIds }, hymnalId: hymnalSettings.primaryHymnalId } })
      : [];
    if (selectedHymnIds.length !== savedHymns.length) return NextResponse.json({ error: "One or more selected hymns are not in the primary hymnal." }, { status: 400 });
    const savedHymnById = new Map(savedHymns.map((hymn) => [hymn.id, hymn]));
    const normalizedHymns = hymns.map((hymn) => {
      if (hymn.hymnId) {
        const saved = savedHymnById.get(hymn.hymnId);
        return { hymnId: hymn.hymnId, custom: false, number: saved?.number, title: saved?.title ?? "", sourceUrl: saved?.sourceUrl };
      }
      return { hymnId: null, custom: true, number: hymn.number, title: hymn.title ?? "", sourceUrl: hymn.sourceUrl };
    });
    const settings = await db.membershipEventSettings.findUnique({ where: { churchId: scope.church.id }, select: { eventTypes: true, categories: true, locations: true, timeZone: true } });
    const eventTypes = Array.isArray(settings?.eventTypes) && settings.eventTypes.length ? settings.eventTypes.filter((item): item is string => typeof item === "string") : DEFAULT_EVENT_TYPES;
    const eventType = resolveEventType(payload.eventType, eventTypes);
    const category = text(payload.category, 100) || null;
    const location = text(payload.location, 200) || null;
    if (addToCalendar && (!eventType || (Array.isArray(settings?.categories) && category && !settings.categories.includes(category)) || (Array.isArray(settings?.locations) && location && !settings.locations.includes(location)))) return NextResponse.json({ error: "Choose valid Event Type, Category, and Location values." }, { status: 400 });
    const bulletin = form.get("bulletin");
    const featuredImage = form.get("featuredImage");
    const assets = [{ file: bulletin, kind: "bulletin" as const, max: 20 * 1024 * 1024 }, { file: featuredImage, kind: "image" as const, max: 10 * 1024 * 1024 }];
    const assetUrls: { bulletinUrl: string | null; featuredImageUrl: string | null } = { bulletinUrl: null, featuredImageUrl: null };
    for (const asset of assets) {
      if (!(asset.file instanceof File) || !asset.file.size) continue;
      const extension = fileExtension(asset.file, asset.kind);
      if (!extension || asset.file.size > asset.max) return NextResponse.json({ error: asset.kind === "bulletin" ? "Bulletins must be PDF files up to 20 MB." : "Featured images must be JPG, PNG, or WebP files up to 10 MB." }, { status: 400 });
      const filename = `${randomUUID()}${extension}`;
      await mkdir(serviceStorage, { recursive: true });
      await writeFile(path.join(serviceStorage, filename), Buffer.from(await asset.file.arrayBuffer()));
      writtenFiles.push(filename);
      assetUrls[asset.kind === "bulletin" ? "bulletinUrl" : "featuredImageUrl"] = `/api/services/services/assets/${filename}`;
    }
    const service = await db.$transaction(async (transaction) => {
      if (addToCalendar) {
        const event = await transaction.membershipEvent.create({
          data: { churchId: scope.church.id, title, description: text(payload.description, 5000) || null, eventType: eventType ?? "Other", category, location, startsAt, endsAt, allDay: false, published: status === "PUBLISHED", timeZone: settings?.timeZone ?? "America/Chicago", createdById: user.id },
          select: { id: true },
        });
        eventId = event.id;
      }
      return transaction.worshipService.create({
        data: {
          churchId: scope.church.id,
          title,
          description: text(payload.description, 5000) || null,
          liturgy: liturgy || null,
          status,
          scheduledAt,
          startsAt,
          endsAt,
          livestreamEnabled: payload.livestreamEnabled === true,
          videoUrl: videoUrl ?? null,
          bulletinUrl: assetUrls.bulletinUrl,
          featuredImageUrl: assetUrls.featuredImageUrl,
          eventId,
          clergy: { create: clergyIds.map((clergyId, sortOrder) => ({ clergyId, sortOrder })) },
          hymns: { create: normalizedHymns.map((hymn, sortOrder) => ({ ...hymn, sortOrder })) },
          lessons: { create: lessons.map((lesson, sortOrder) => ({ ...lesson, sortOrder })) },
        },
        include,
      });
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    await Promise.all(writtenFiles.map((filename) => unlink(path.join(serviceStorage, filename)).catch(() => undefined)));
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create worship service." }, { status: 400 });
  }
}
