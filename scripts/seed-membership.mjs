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
  const churches = await db.church.findMany({ select: { id: true } });
  for (const church of churches) {
    for (const role of roles) await db.membershipFamilyRole.upsert({ where: { churchId_slug: { churchId: church.id, slug: role.slug } }, update: { name: role.name }, create: { ...role, churchId: church.id } });
  }
  const church = churches[0];
  if (church) for (const type of memberTypes) await db.membershipMemberType.upsert({ where: { slug: type.slug }, update: { name: type.name }, create: { ...type, churchId: church.id } });
  console.log("Seeded membership roles and member types.");
} finally {
  await db.$disconnect();
}
