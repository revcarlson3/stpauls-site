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

export async function updateMenuItems(id: string, input: MenuItemInput[]) {
  await requirePermission("MANAGE_MENUS");
  return db.$transaction(async (tx) => {
    const existing = await tx.menuItem.findMany({ where: { menuId: id }, select: { id: true } });
    const existingIds = new Set(existing.map((item) => item.id));
    const submittedIds = input.flatMap((item) => item.id ? [item.id] : []);
    if (submittedIds.some((itemId) => !existingIds.has(itemId))) throw new Error("Invalid menu item.");
    await tx.menuItem.deleteMany({ where: { menuId: id, id: { notIn: submittedIds } } });
    for (const item of input) {
      const data = { label: item.label, href: item.href, itemType: item.itemType, openInNewTab: item.openInNewTab, position: item.position, parentId: null };
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
