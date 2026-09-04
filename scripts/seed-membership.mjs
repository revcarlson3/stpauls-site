import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const roles = [
  { slug: "head-of-household", name: "Head of Household" },
  { slug: "spouse", name: "Spouse" },
  { slug: "child", name: "Child" },
  { slug: "other", name: "Other" }
];
const memberTypes = [
  { slug: "member", name: "Member" },
  { slug: "visitor", name: "Visitor" },
  { slug: "inactive", name: "Inactive" }
];

try {
  for (const role of roles) await db.membershipFamilyRole.upsert({ where: { slug: role.slug }, update: { name: role.name }, create: role });
  for (const type of memberTypes) await db.membershipMemberType.upsert({ where: { slug: type.slug }, update: { name: type.name }, create: type });
  console.log("Seeded membership roles and member types.");
} finally {
  await db.$disconnect();
}
