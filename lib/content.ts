import { db } from "@/lib/db";
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
