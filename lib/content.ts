import { db } from "@/lib/db";
import type { MenuItemInput } from "@/lib/menu-input";
import { requirePermission, type User } from "@/lib/auth";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export type PageBlock = {
  id: string;
  type: string;
  props: JsonObject;
};

function blocksValue(blocks: PageBlock[]): JsonValue[] {
  return blocks;
}

export async function listPages() {
  await requirePermission("EDIT_PAGES");
  return db.page.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function createPage(input: { title: string; slug: string; blocks: PageBlock[]; menuId?: string | null }) {
  const author = await requirePermission("EDIT_PAGES");
  await validateMenu(input.menuId);
  return db.page.create({
    data: {
      title: input.title,
      slug: input.slug,
      blocks: blocksValue(input.blocks),
      menuId: input.menuId,
      revisions: {
        create: revisionData(input, author)
      }
    }
  });
}

export async function updatePage(id: string, input: { title: string; slug: string; blocks: PageBlock[]; menuId?: string | null }) {
  const author = await requirePermission("EDIT_PAGES");
  await validateMenu(input.menuId);
  return db.page.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      blocks: blocksValue(input.blocks),
      menuId: input.menuId,
      revisions: {
        create: revisionData(input, author)
      }
    }
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

function revisionData(input: { title: string; blocks: PageBlock[] }, author: User) {
  return { title: input.title, blocks: blocksValue(input.blocks), authorId: author.id };
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

export async function resolvePublicMenu(menuId?: string | null, menuLocationId?: string | null) {
  const menu = menuId
    ? await db.menu.findUnique({ where: { id: menuId }, include: { items: { orderBy: { position: "asc" } } } })
    : menuLocationId
      ? (await db.menuLocation.findUnique({ where: { id: menuLocationId }, include: { menu: { include: { items: { orderBy: { position: "asc" } } } } } }))?.menu
      : (await db.menuLocation.findUnique({ where: { slug: "primary" }, include: { menu: { include: { items: { orderBy: { position: "asc" } } } } } }))?.menu ?? null;
  return menu;
}
