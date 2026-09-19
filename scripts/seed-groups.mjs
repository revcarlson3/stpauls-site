import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const groups = [
  { slug: "visitor", name: "Visitor", permissions: [] },
  { slug: "church-member", name: "Church Member", permissions: ["MY_MEMBERSHIP"] },
  { slug: "editor", name: "Editor", permissions: ["ACCESS_ADMIN", "EDIT_PAGES", "MANAGE_MENUS"] },
  { slug: "administrator", name: "Administrator", permissions: ["ACCESS_ADMIN", "MY_MEMBERSHIP", "EDIT_PAGES", "PUBLISH_PAGES", "MANAGE_MENUS", "MANAGE_USERS", "MANAGE_SETTINGS", "MANAGE_MODULES", "MANAGE_MEMBERSHIP", "MANAGE_EVENTS", "MANAGE_GIVING", "MANAGE_ACCOUNTING", "MANAGE_SERVICES"] }
];

try {
  const churches = await db.church.findMany({ select: { id: true } });
  for (const church of churches) {
    const seeded = {};
    for (const group of groups) {
      const existing = await db.securityGroup.upsert({
        where: { churchId_slug: { churchId: church.id, slug: group.slug } },
        update: { name: group.name },
        create: { churchId: church.id, name: group.name, slug: group.slug }
      });
      seeded[group.slug] = existing.id;
      await db.groupPermission.deleteMany({ where: { groupId: existing.id } });
      await db.groupPermission.createMany({ data: group.permissions.map((permission) => ({ groupId: existing.id, permission })) });
    }
    const linkedUsers = await db.user.findMany({ where: { role: { not: "admin" }, isPlatformAdmin: false, churchMemberships: { some: { churchId: church.id } }, membershipMemberLink: { isNot: null } }, select: { id: true } });
    if (linkedUsers.length) await db.user.updateMany({ where: { id: { in: linkedUsers.map((user) => user.id) } }, data: { groupId: seeded["church-member"] } });
    await db.user.updateMany({ where: { role: "viewer", groupId: null, churchMemberships: { some: { churchId: church.id } } }, data: { groupId: seeded.visitor } });
  }
  console.log(`Seeded ${groups.length} security groups for ${churches.length} churches.`);
} finally {
  await db.$disconnect();
}
