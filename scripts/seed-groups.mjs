import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const groups = [
  { slug: "visitor", name: "Visitor", permissions: [] },
  { slug: "editor", name: "Editor", permissions: ["ACCESS_ADMIN", "EDIT_PAGES", "MANAGE_MENUS"] },
  { slug: "administrator", name: "Administrator", permissions: ["ACCESS_ADMIN", "EDIT_PAGES", "PUBLISH_PAGES", "MANAGE_MENUS", "MANAGE_USERS", "MANAGE_SETTINGS", "MANAGE_MODULES", "MANAGE_MEMBERSHIP", "MANAGE_EVENTS", "MANAGE_GIVING", "MANAGE_ACCOUNTING", "MANAGE_SERVICES"] }
];

try {
  for (const group of groups) {
    const existing = await db.securityGroup.upsert({
      where: { slug: group.slug },
      update: { name: group.name },
      create: { name: group.name, slug: group.slug }
    });
    await db.groupPermission.deleteMany({ where: { groupId: existing.id } });
    await db.groupPermission.createMany({ data: group.permissions.map((permission) => ({ groupId: existing.id, permission })) });
  }
  console.log(`Seeded ${groups.length} security groups.`);
} finally {
  await db.$disconnect();
}
