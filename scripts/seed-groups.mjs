import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const groups = [
  { slug: "visitor", name: "Visitor", permissions: [] },
  { slug: "church-member", name: "Church Member", permissions: ["MY_MEMBERSHIP"] },
  { slug: "editor", name: "Editor", permissions: ["ACCESS_ADMIN", "EDIT_PAGES", "MANAGE_MENUS"] },
  { slug: "administrator", name: "Administrator", permissions: ["ACCESS_ADMIN", "MY_MEMBERSHIP", "EDIT_PAGES", "PUBLISH_PAGES", "MANAGE_MENUS", "MANAGE_USERS", "MANAGE_SETTINGS", "MANAGE_MODULES", "MANAGE_MEMBERSHIP", "MANAGE_EVENTS", "MANAGE_GIVING", "MANAGE_ACCOUNTING", "MANAGE_SERVICES"] }
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
  const churchMember = await db.securityGroup.findUnique({ where: { slug: "church-member" }, select: { id: true } });
  const visitor = await db.securityGroup.findUnique({ where: { slug: "visitor" }, select: { id: true } });
  if (churchMember) {
    const linkedUsers = await db.user.findMany({ where: { role: { not: "admin" }, membershipMemberLink: { isNot: null } }, select: { id: true } });
    if (linkedUsers.length) await db.user.updateMany({ where: { id: { in: linkedUsers.map((user) => user.id) } }, data: { groupId: churchMember.id } });
  }
  if (visitor) await db.user.updateMany({ where: { role: "viewer", groupId: null }, data: { groupId: visitor.id } });
  console.log(`Seeded ${groups.length} security groups.`);
} finally {
  await db.$disconnect();
}
