import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const normalize = (value) => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
};

try {
  const [individuals, families] = await Promise.all([
    db.membershipIndividual.findMany({ select: { id: true, cellphone: true, otherPhone: true } }),
    db.membershipFamily.findMany({ select: { id: true, phone: true } })
  ]);
  await db.$transaction([
    ...individuals
      .filter((person) => normalize(person.cellphone) !== person.cellphone || normalize(person.otherPhone) !== person.otherPhone)
      .map((person) => db.membershipIndividual.update({ where: { id: person.id }, data: { cellphone: normalize(person.cellphone), otherPhone: normalize(person.otherPhone) } })),
    ...families
      .filter((family) => normalize(family.phone) !== family.phone)
      .map((family) => db.membershipFamily.update({ where: { id: family.id }, data: { phone: normalize(family.phone) } }))
  ]);
  console.log(`Normalized ${individuals.length} individual records and ${families.length} family records.`);
} finally {
  await db.$disconnect();
}
