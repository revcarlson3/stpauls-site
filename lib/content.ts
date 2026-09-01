import { db } from "@/lib/db";
import { requireRole, type User } from "@/lib/auth";

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
  await requireRole("editor");
  return db.page.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function createPage(input: { title: string; slug: string; blocks: PageBlock[] }) {
  const author = await requireRole("editor");
  return db.page.create({
    data: {
      title: input.title,
      slug: input.slug,
      blocks: blocksValue(input.blocks),
      revisions: {
        create: revisionData(input, author)
      }
    }
  });
}

export async function updatePage(id: string, input: { title: string; slug: string; blocks: PageBlock[] }) {
  const author = await requireRole("editor");
  return db.page.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      blocks: blocksValue(input.blocks),
      revisions: {
        create: revisionData(input, author)
      }
    }
  });
}

export async function publishPage(id: string) {
  const author = await requireRole("admin");
  return db.page.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: author.id }
  });
}

function revisionData(input: { title: string; blocks: PageBlock[] }, author: User) {
  return { title: input.title, blocks: blocksValue(input.blocks), authorId: author.id };
}

export async function listMenus() {
  await requireRole("editor");
  return db.menu.findMany({ include: { items: { orderBy: { position: "asc" } } }, orderBy: { name: "asc" } });
}

export async function createMenu(input: { name: string; slug: string }) {
  await requireRole("admin");
  return db.menu.create({ data: input });
}
