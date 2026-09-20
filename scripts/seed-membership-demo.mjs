import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const families = [
  ["Anderson", "Michael", "Laura", "michael.anderson@example.test", "612-555-0101"],
  ["Bennett", "David", "Rachel", "david.bennett@example.test", "612-555-0102"],
  ["Carter", "James", "Emily", "james.carter@example.test", "612-555-0103"],
  ["Davis", "Robert", "Sarah", "robert.davis@example.test", "612-555-0104"],
  ["Evans", "Thomas", "Jennifer", "thomas.evans@example.test", "612-555-0105"],
  ["Foster", "Daniel", "Megan", "daniel.foster@example.test", "763-555-0111", "Princeton", "55371"],
  ["Garcia", "Anthony", "Maria", "anthony.garcia@example.test", "320-555-0112", "Saint Cloud", "56301"],
  ["Hughes", "William", "Natalie", "william.hughes@example.test", "612-555-0113", "Minneapolis", "55408"],
  ["Larson", "Peter", "Nicole", "peter.larson@example.test", "320-555-0114", "Mora", "55051"],
  ["Patel", "Raj", "Anika", "raj.patel@example.test", "763-555-0115", "Foley", "56329"]
];
try {
  const church = await db.church.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const headRole = await db.membershipFamilyRole.findUniqueOrThrow({ where: { churchId_slug: { churchId: church.id, slug: "head-of-household" } } });
  const spouseRole = await db.membershipFamilyRole.findUniqueOrThrow({ where: { churchId_slug: { churchId: church.id, slug: "spouse" } } });
  const memberType = await db.membershipMemberType.findUniqueOrThrow({ where: { slug: "member" } });
  for (let index = 0; index < families.length; index += 1) {
    const [lastName, headFirst, spouseFirst, email, phone, city = "Milaca", zip = "56353"] = families[index];
    const existing = await db.membershipFamily.findFirst({ where: { email } });
    if (existing) continue;
    const family = await db.membershipFamily.create({ data: {
      churchId: church.id,
      lastName, formalGreeting: `Mr. & Mrs. ${headFirst} ${lastName}`, informalGreeting: `${headFirst} and ${spouseFirst}`,
      addressStreet: `${100 + index} Example Avenue`, addressCity: city, addressState: "MN", addressZip: `${zip}-000${index + 1}`,
      secondaryStreet: `PO Box ${200 + index}`, secondaryCity: city, secondaryState: "MN", secondaryZip: zip, secondaryIsMailing: true,
      phone, phoneIsMobile: true, email, photographUrl: `https://i.pravatar.cc/800?img=${index + 12}`,
      individuals: { create: [
        { firstName: headFirst, middleName: "James", birthday: new Date(`198${index}-03-12`), ageCategoryOverride: "Adult", cellphone: phone, otherPhone: `320-555-01${index}1`, otherPhoneType: "landline", email, memberNumber: index * 2 + 1, gradeLevel: "Post-graduate", maritalStatus: "Married", weddingDate: new Date(`201${index}-06-15`), gender: "MALE", memberTypeId: memberType.id, familyRoleId: headRole.id },
        { firstName: spouseFirst, middleName: "Anne", birthday: new Date(`198${index}-08-24`), ageCategoryOverride: "Adult", cellphone: `612-555-02${index}2`, otherPhone: `320-555-02${index}2`, otherPhoneType: "landline", email: `${spouseFirst.toLowerCase()}.${lastName.toLowerCase()}@example.test`, memberNumber: index * 2 + 2, gradeLevel: "Post-graduate", maritalStatus: "Married", weddingDate: new Date(`201${index}-06-15`), gender: "FEMALE", memberTypeId: memberType.id, familyRoleId: spouseRole.id }
      ] }
    } });
    console.log(`Created demo family ${family.lastName} in ${city}.`);
  }
} finally {
  await db.$disconnect();
}
