import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { MenuItemInput } from "@/lib/menu-input";
import { requirePermission, type User } from "@/lib/auth";
import bcrypt from "bcryptjs";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export type PageBlock = {
  id: string;
  type: string;
  props: JsonObject;
};

export type PageInputLike = {
  title: string;
  slug: string;
  blocks: PageBlock[];
  menuId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  publishAt?: string | null;
  pageThemeFamily?: string | null;
  pageThemeWidth?: string | null;
  showHeader?: boolean;
  showFooter?: boolean;
  fullScreen?: boolean;
  expectedUpdatedAt?: string;
  accessPassword?: string | null;
};

type RevisionKind = "MANUAL" | "AUTOSAVE";

function blocksValue(blocks: PageBlock[]): JsonValue[] {
  return blocks;
}

export async function listPages() {
  await requirePermission("EDIT_PAGES");
  return db.page.findMany({ orderBy: [{ isHome: "desc" }, { title: "asc" }] });
}

export async function listWidgets() {
  await requirePermission("EDIT_PAGES");
  return db.widget.findMany({ orderBy: [{ area: "asc" }, { position: "asc" }, { name: "asc" }] });
}

export async function resolvePublicWidget(id: string | null) {
  if (!id) return null;
  return db.widget.findFirst({
    where: { id, enabled: true },
    select: { id: true, name: true, type: true, config: true }
  });
}

export async function listPublicWidgets(area: "sidebar" | "footer" | "page", pageId?: string | null, pageSlug?: string | null) {
  const widgets = await db.widget.findMany({
    where: { area, enabled: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, config: true }
  });
  return widgets.filter((widget) => {
    if (area !== "page") return true;
    const config = widget.config && typeof widget.config === "object" && !Array.isArray(widget.config)
      ? widget.config as Record<string, unknown>
      : {};
    const configuredPageId = typeof config.pageId === "string" ? config.pageId : null;
    const configuredPageSlug = typeof config.pageSlug === "string" ? config.pageSlug : null;
    return (pageId && configuredPageId === pageId) || (pageSlug && configuredPageSlug === pageSlug);
  });
}

export async function createWidget(input: { name: string; type: string; area: string; config: Record<string, unknown>; position?: number; enabled?: boolean }) {
  await requirePermission("EDIT_PAGES");
  return db.widget.create({ data: { name: input.name, type: input.type, area: input.area, config: input.config as Prisma.InputJsonValue, position: input.position ?? 0, enabled: input.enabled ?? true } });
}

export async function updateWidget(id: string, input: { name: string; type: string; area: string; config: Record<string, unknown>; position?: number; enabled?: boolean }) {
  await requirePermission("EDIT_PAGES");
  return db.widget.update({ where: { id }, data: { name: input.name, type: input.type, area: input.area, config: input.config as Prisma.InputJsonValue, position: input.position ?? 0, enabled: input.enabled ?? true } });
}

export async function deleteWidget(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.widget.delete({ where: { id } });
}

export async function createPage(input: PageInputLike) {
  const author = await requirePermission("EDIT_PAGES");
  await validateMenu(input.menuId);
  return db.page.create({
    data: {
      title: input.title,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      seoKeywords: input.seoKeywords || null,
      slug: input.slug,
      blocks: blocksValue(input.blocks),
      menuId: input.menuId,
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      pageThemeFamily: input.pageThemeFamily || null,
      pageThemeWidth: input.pageThemeWidth || null,
      showHeader: input.showHeader ?? true,
      showFooter: input.showFooter ?? true,
      fullScreen: input.fullScreen ?? false,
      ...(await pagePasswordData(input)),
      revisions: {
        create: revisionData(input, author, "MANUAL")
      }
    }
  });
}

export async function updatePage(id: string, input: PageInputLike, revisionKind: RevisionKind = "MANUAL") {
  const author = await requirePermission("EDIT_PAGES");
  await validateMenu(input.menuId);
  const latestRevision = revisionKind === "AUTOSAVE" ? await db.pageRevision.findFirst({ where: { pageId: id, kind: "AUTOSAVE" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }) : null;
  const shouldRecordRevision = revisionKind === "MANUAL" || !latestRevision || Date.now() - latestRevision.createdAt.getTime() >= 5 * 60 * 1000;
  const passwordData = await pagePasswordData(input);
  return db.$transaction(async (tx) => {
    const result = await tx.page.updateMany({
      where: {
        id,
        ...(input.expectedUpdatedAt ? { updatedAt: new Date(input.expectedUpdatedAt) } : {})
      },
      data: { ...pageData(input), ...passwordData }
    });
    if (result.count === 0) {
      const exists = await tx.page.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new Error("Page not found.");
      throw new Error("Page conflict.");
    }
    if (shouldRecordRevision) await tx.pageRevision.create({ data: { ...revisionData(input, author, revisionKind), pageId: id } });
    return tx.page.findUniqueOrThrow({ where: { id } });
  });
}

export async function listPageRevisions(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.pageRevision.findMany({
    where: { pageId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, kind: true, createdAt: true, author: { select: { name: true } }, snapshot: true, blocks: true }
  });
}

export async function restorePageRevision(id: string, revisionId: string, expectedUpdatedAt?: string) {
  const author = await requirePermission("EDIT_PAGES");
  const revision = await db.pageRevision.findFirst({ where: { id: revisionId, pageId: id } });
  if (!revision) throw new Error("Revision not found.");
  const snapshot = revision.snapshot && typeof revision.snapshot === "object" && !Array.isArray(revision.snapshot) ? revision.snapshot as Record<string, unknown> : null;
  const page = await db.page.findUnique({ where: { id }, select: { title: true, slug: true, blocks: true, menuId: true, seoTitle: true, seoDescription: true, seoKeywords: true, publishAt: true, pageThemeFamily: true, pageThemeWidth: true, showHeader: true, showFooter: true, fullScreen: true, updatedAt: true } });
  if (!page) throw new Error("Page not found.");
  if (expectedUpdatedAt && page.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new Error("Page conflict.");
  const savedValue = <T>(key: string, fallback: T): T => snapshot && Object.prototype.hasOwnProperty.call(snapshot, key) ? snapshot[key] as T : fallback;
  const input: PageInputLike = {
    title: savedValue("title", revision.title),
    slug: savedValue("slug", page.slug),
    blocks: Array.isArray(snapshot?.blocks) ? snapshot.blocks as PageBlock[] : revision.blocks as PageBlock[],
    menuId: savedValue("menuId", page.menuId),
    seoTitle: savedValue("seoTitle", page.seoTitle),
    seoDescription: savedValue("seoDescription", page.seoDescription),
    seoKeywords: savedValue("seoKeywords", page.seoKeywords),
    publishAt: savedValue("publishAt", page.publishAt?.toISOString() ?? null),
    pageThemeFamily: savedValue("pageThemeFamily", page.pageThemeFamily),
    pageThemeWidth: savedValue("pageThemeWidth", page.pageThemeWidth),
    showHeader: typeof snapshot?.showHeader === "boolean" ? snapshot.showHeader : page.showHeader,
    showFooter: typeof snapshot?.showFooter === "boolean" ? snapshot.showFooter : page.showFooter,
    fullScreen: typeof snapshot?.fullScreen === "boolean" ? snapshot.fullScreen : page.fullScreen
  };
  const currentInput: PageInputLike = {
    title: page.title,
    slug: page.slug,
    blocks: page.blocks as PageBlock[],
    menuId: page.menuId,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    seoKeywords: page.seoKeywords,
    publishAt: page.publishAt?.toISOString() ?? null,
    pageThemeFamily: page.pageThemeFamily,
    pageThemeWidth: page.pageThemeWidth,
    showHeader: page.showHeader,
    showFooter: page.showFooter,
    fullScreen: page.fullScreen
  };
  return db.$transaction(async (tx) => {
    await tx.pageRevision.create({ data: { ...revisionData(currentInput, author, "MANUAL"), pageId: id } });
    const result = await tx.page.updateMany({ where: { id, updatedAt: page.updatedAt }, data: pageData(input) });
    if (result.count === 0) throw new Error("Page conflict.");
    return tx.page.findUniqueOrThrow({ where: { id } });
  });
}

export async function getPage(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.page.findUnique({ where: { id } });
}

export async function publishPage(id: string) {
  const author = await requirePermission("PUBLISH_PAGES");
  return db.page.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: author.id }
  });
}

export async function archivePage(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.page.update({ where: { id }, data: { status: "ARCHIVED" } });
}

export async function restorePage(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.page.update({ where: { id }, data: { status: "DRAFT", publishedAt: null, publishedById: null } });
}

export async function duplicatePage(id: string) {
  const author = await requirePermission("EDIT_PAGES");
  const source = await db.page.findUnique({ where: { id } });
  if (!source) throw new Error("Page not found.");
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (await db.page.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return db.page.create({
    data: {
      title: `${source.title} (Copy)`,
      slug,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      seoKeywords: source.seoKeywords,
      blocks: source.blocks as Prisma.InputJsonValue,
      menuId: source.menuId,
      publishAt: null,
      pageThemeFamily: source.pageThemeFamily,
      pageThemeWidth: source.pageThemeWidth,
      showHeader: source.showHeader,
      showFooter: source.showFooter,
      fullScreen: source.fullScreen,
      passwordHash: source.passwordHash,
      revisions: { create: { title: `${source.title} (Copy)`, blocks: source.blocks as Prisma.InputJsonValue, authorId: author.id } }
    }
  });
}

export async function deletePage(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.page.delete({ where: { id } });
}

export async function setHomePage(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.$transaction(async (tx) => {
    await tx.page.updateMany({ data: { isHome: false } });
    return tx.page.update({ where: { id }, data: { isHome: true } });
  });
}

function revisionData(input: PageInputLike, author: User, kind: RevisionKind) {
  const { expectedUpdatedAt: _expectedUpdatedAt, accessPassword: _accessPassword, ...snapshot } = input;
  return { title: input.title, blocks: blocksValue(input.blocks), snapshot: snapshot as Prisma.InputJsonValue, kind, authorId: author.id };
}

async function pagePasswordData(input: PageInputLike) {
  if (input.accessPassword === undefined) return {};
  return { passwordHash: input.accessPassword === null ? null : await bcrypt.hash(input.accessPassword, 12) };
}

function pageData(input: PageInputLike) {
  return {
    title: input.title,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    seoKeywords: input.seoKeywords || null,
    slug: input.slug,
    blocks: blocksValue(input.blocks),
    menuId: input.menuId,
    publishAt: input.publishAt ? new Date(input.publishAt) : null,
    pageThemeFamily: input.pageThemeFamily || null,
    pageThemeWidth: input.pageThemeWidth || null,
    showHeader: input.showHeader ?? true,
    showFooter: input.showFooter ?? true,
    fullScreen: input.fullScreen ?? false
  };
}

async function validateMenu(menuId: string | null | undefined) {
  if (menuId === undefined || menuId === null) return;
  const menu = await db.menu.findUnique({ where: { id: menuId }, select: { id: true } });
  if (!menu) throw new Error("Invalid menu assignment.");
}

export async function listMenus() {
  await requirePermission("MANAGE_MENUS");
  return db.menu.findMany({ include: { items: { orderBy: { position: "asc" } } }, orderBy: { name: "asc" } });
}

export async function listMenuOptions() {
  await requirePermission("MANAGE_MENUS");
  return db.menu.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function createMenu(input: { name: string; slug: string }) {
  await requirePermission("MANAGE_MENUS");
  return db.menu.create({ data: input });
}

export async function getMenu(id: string) {
  await requirePermission("MANAGE_MENUS");
  return db.menu.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
}

export async function updateMenu(id: string, input: { name: string; slug: string }) {
  await requirePermission("MANAGE_MENUS");
  return db.menu.update({ where: { id }, data: input, include: { items: { orderBy: { position: "asc" } } } });
}

export async function updateMenuItems(id: string, input: { name: string; slug: string; items: MenuItemInput[] }) {
  await requirePermission("MANAGE_MENUS");
  return db.$transaction(async (tx) => {
    await tx.menu.update({ where: { id }, data: { name: input.name, slug: input.slug } });
    const existing = await tx.menuItem.findMany({ where: { menuId: id }, select: { id: true } });
    const existingIds = new Set(existing.map((item) => item.id));
    const submittedIds = input.items.flatMap((item) => item.id ? [item.id] : []);
    if (submittedIds.some((itemId) => !existingIds.has(itemId))) throw new Error("Invalid menu item.");
    const submittedIdSet = new Set(submittedIds);
    for (const item of input.items) {
      if (item.parentId && (!submittedIdSet.has(item.parentId) || item.parentId === item.id)) throw new Error("Invalid menu item parent.");
    }

    const parents = new Map(input.items.flatMap((item) => item.id ? [[item.id, item.parentId ?? null] as const] : []));
    for (const item of input.items) {
      const seen = new Set<string>();
      let parent = item.parentId ?? null;
      while (parent) {
        if (seen.has(parent)) throw new Error("Invalid menu item parent.");
        seen.add(parent);
        parent = parents.get(parent) ?? null;
      }
    }
    await tx.menuItem.deleteMany({ where: { menuId: id, id: { notIn: submittedIds } } });
    for (const item of input.items) {
      const data = { label: item.label, href: item.href, itemType: item.itemType, openInNewTab: item.openInNewTab, position: item.position, parentId: item.parentId ?? null };
      if (item.id) await tx.menuItem.update({ where: { id: item.id }, data });
      else await tx.menuItem.create({ data: { ...data, menuId: id } });
    }
    return tx.menu.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  });
}

export async function deleteMenu(id: string) {
  await requirePermission("MANAGE_MENUS");
  const menu = await db.menu.findUnique({ where: { id }, select: { _count: { select: { pages: true, locations: true } } } });
  if (!menu) throw new Error("Menu not found.");
  if (menu._count.pages > 0 || menu._count.locations > 0) throw new Error("Menus assigned to pages or locations cannot be deleted.");
  return db.menu.delete({ where: { id } });
}

export async function listMenuPageOptions() {
  await requirePermission("MANAGE_MENUS");
  return db.page.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true }, orderBy: { title: "asc" } });
}

const defaultMenuLocations = [
  { slug: "primary", name: "Primary navigation" },
  { slug: "mobile", name: "Mobile navigation" },
  { slug: "footer", name: "Footer navigation" },
  { slug: "utility", name: "Utility navigation" }
];

export async function listMenuLocations() {
  await requirePermission("MANAGE_MENUS");
  await db.$transaction(defaultMenuLocations.map((location) => db.menuLocation.upsert({ where: { slug: location.slug }, create: location, update: { name: location.name } })));
  return db.menuLocation.findMany({ include: { menu: { select: { id: true, name: true, slug: true } } }, orderBy: { id: "asc" } });
}

export async function updateMenuLocation(id: string, menuId: string | null) {
  await requirePermission("MANAGE_MENUS");
  if (menuId && !(await db.menu.findUnique({ where: { id: menuId }, select: { id: true } }))) throw new Error("Invalid menu assignment.");
  return db.menuLocation.update({ where: { id }, data: { menuId }, include: { menu: { select: { id: true, name: true, slug: true } } } });
}

export async function createMenuLocation(input: { name: string; slug: string }) {
  await requirePermission("MANAGE_MENUS");
  return db.menuLocation.create({ data: input });
}

export async function deleteMenuLocation(id: string) {
  await requirePermission("MANAGE_MENUS");
  const location = await db.menuLocation.findUnique({ where: { id }, select: { slug: true } });
  if (!location) throw new Error("Menu location not found.");
  if (defaultMenuLocations.some((item) => item.slug === location.slug)) throw new Error("Default menu locations cannot be deleted.");
  return db.menuLocation.delete({ where: { id } });
}

export async function resolvePublicMenu(menuId?: string | null, menuLocationId?: string | null, defaultLocationSlug?: string | null) {
  const menu = menuId
    ? await db.menu.findUnique({ where: { id: menuId }, include: { items: { orderBy: { position: "asc" } } } })
    : menuLocationId
      ? (await db.menuLocation.findUnique({ where: { id: menuLocationId }, include: { menu: { include: { items: { orderBy: { position: "asc" } } } } } }))?.menu
      : defaultLocationSlug
        ? (await db.menuLocation.findUnique({ where: { slug: defaultLocationSlug }, include: { menu: { include: { items: { orderBy: { position: "asc" } } } } } }))?.menu
        : null;
  return menu;
}
