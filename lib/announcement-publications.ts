import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { sanitizeAnnouncementHtml } from "@/lib/announcement-content";
import { announcementDocumentToHtml, parseAnnouncementDocument, parseOrMigrateAnnouncementDocument, type AnnouncementDocument } from "@/lib/announcement-document";

export const publicationStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type AnnouncementPublicationStatus = (typeof publicationStatuses)[number];

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parsePublicationInput(input: Record<string, unknown>) {
  const title = cleanText(input.title, 200);
  const legacyBodyHtml = sanitizeAnnouncementHtml(typeof input.bodyHtml === "string" ? input.bodyHtml : "");
  const suppliedDocument = parseAnnouncementDocument(input.documentJson);
  if (!suppliedDocument && legacyBodyHtml.replace(/<[^>]*>/g, "").trim().length === 0) throw new Error("Publication content is required.");
  const documentJson = suppliedDocument ?? parseOrMigrateAnnouncementDocument(null, title, legacyBodyHtml);
  const bodyHtml = suppliedDocument ? sanitizeAnnouncementHtml(announcementDocumentToHtml(documentJson)) : legacyBodyHtml;
  const publishAtValue = cleanText(input.publishAt, 80);
  const publishAt = publishAtValue ? new Date(publishAtValue) : null;
  if (!title) throw new Error("A publication title is required.");
  if (!bodyHtml || bodyHtml.replace(/<[^>]*>/g, "").trim().length === 0) throw new Error("Publication content is required.");
  if (Number.isNaN(publishAt?.getTime())) throw new Error("The publication date is invalid.");
  return { title, bodyHtml, documentJson, publishAt };
}

const publicationSelect = {
  id: true,
  title: true,
  bodyHtml: true,
  documentJson: true,
  status: true,
  publishAt: true,
  publishedAt: true,
  sourceId: true,
  createdAt: true,
  updatedAt: true,
  emailDelivery: { select: { status: true, recipientCount: true, sentCount: true, failedCount: true, completedAt: true, note: true } }
} as const;

const templateSelect = {
  id: true,
  name: true,
  title: true,
  bodyHtml: true,
  documentJson: true,
  createdAt: true,
  updatedAt: true
} as const;

function serializePublication(publication: {
  id: string;
  title: string;
  bodyHtml: string;
  documentJson: unknown;
  status: string;
  publishAt: Date | null;
  publishedAt: Date | null;
  sourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  emailDelivery: { status: string; recipientCount: number; sentCount: number; failedCount: number; completedAt: Date | null; note: string | null } | null;
}) {
  return {
    ...publication,
    publishAt: publication.publishAt?.toISOString() ?? null,
    publishedAt: publication.publishedAt?.toISOString() ?? null,
    createdAt: publication.createdAt.toISOString(),
    updatedAt: publication.updatedAt.toISOString(),
    documentJson: publication.documentJson,
    emailDelivery: publication.emailDelivery ? { ...publication.emailDelivery, completedAt: publication.emailDelivery.completedAt?.toISOString() ?? null } : null
  };
}

export async function listTenantPublications() {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const [publications, templates] = await Promise.all([
    db.announcementPublication.findMany({ where: { churchId: user.churchId }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], select: publicationSelect }),
    db.announcementTemplate.findMany({ where: { churchId: user.churchId }, orderBy: { updatedAt: "desc" }, select: templateSelect })
  ]);
  return { publications: publications.map(serializePublication), templates };
}

export async function createPublication(input: Record<string, unknown>) {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const data = parsePublicationInput(input);
  const publication = await db.announcementPublication.create({
    data: { churchId: user.churchId, createdById: user.id, ...data },
    select: publicationSelect
  });
  return serializePublication(publication);
}

export async function updatePublication(id: string, input: Record<string, unknown>) {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const existing = await db.announcementPublication.findFirst({ where: { id, churchId: user.churchId }, select: { id: true, status: true } });
  if (!existing) throw new Error("Publication not found.");
  const data = parsePublicationInput(input);
  const publication = await db.announcementPublication.update({ where: { id }, data, select: publicationSelect });
  return serializePublication(publication);
}

export async function duplicatePublication(id: string) {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const source = await db.announcementPublication.findFirst({ where: { id, churchId: user.churchId }, select: { title: true, bodyHtml: true, documentJson: true } });
  if (!source) throw new Error("Publication not found.");
  const publication = await db.announcementPublication.create({
    data: { churchId: user.churchId, createdById: user.id, sourceId: id, title: `${source.title} (copy)`.slice(0, 200), bodyHtml: source.bodyHtml, documentJson: source.documentJson ?? undefined },
    select: publicationSelect
  });
  return serializePublication(publication);
}

export async function setPublicationStatus(id: string, status: AnnouncementPublicationStatus) {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const publication = await db.announcementPublication.findFirst({ where: { id, churchId: user.churchId }, select: { id: true } });
  if (!publication) throw new Error("Publication not found.");
  const updated = await db.announcementPublication.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined },
    select: publicationSelect
  });
  return serializePublication(updated);
}

export async function deletePublication(id: string) {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const deleted = await db.announcementPublication.deleteMany({ where: { id, churchId: user.churchId, status: { not: "PUBLISHED" } } });
  if (!deleted.count) throw new Error("Only draft or archived publications can be deleted.");
}

export async function createTemplate(input: Record<string, unknown>) {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const name = cleanText(input.name, 120);
  const { title, bodyHtml, documentJson } = parsePublicationInput(input);
  if (!name) throw new Error("A template name is required.");
  const template = await db.announcementTemplate.create({ data: { churchId: user.churchId, createdById: user.id, name, title, bodyHtml, documentJson }, select: templateSelect });
  return template;
}

export async function deleteTemplate(id: string) {
  const user = await requirePermission("MANAGE_SETTINGS");
  if (!user.churchId) throw new Error("A church membership is required.");
  const deleted = await db.announcementTemplate.deleteMany({ where: { id, churchId: user.churchId } });
  if (!deleted.count) throw new Error("Template not found.");
}

export async function listPublicAnnouncementData(churchId: string) {
  const now = new Date();
  const [latest, archive] = await Promise.all([
    db.announcementPublication.findFirst({ where: { churchId, status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: now } }] }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], select: { id: true, title: true, bodyHtml: true, publishedAt: true } }),
    db.announcementPublication.findMany({ where: { churchId, status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: now } }] }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: 50, select: { id: true, title: true, publishedAt: true } })
  ]);
  return {
    latest: latest ? { ...latest, publishedAt: latest.publishedAt?.toISOString() ?? null } : null,
    archive: archive.map((item) => ({ ...item, publishedAt: item.publishedAt?.toISOString() ?? null }))
  };
}

export async function getPublicAnnouncement(churchId: string, id: string) {
  const now = new Date();
  const publication = await db.announcementPublication.findFirst({
    where: { id, churchId, status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
    select: { id: true, title: true, bodyHtml: true, publishedAt: true }
  });
  return publication ? { ...publication, publishedAt: publication.publishedAt?.toISOString() ?? null } : null;
}
