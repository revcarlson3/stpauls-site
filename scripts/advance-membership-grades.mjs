import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const schoolYear = new Date().getMonth() < 8 ? new Date().getFullYear() - 1 : new Date().getFullYear();

try {
  const people = await db.membershipIndividual.findMany({
    where: { status: { not: "REMOVED" } },
    select: { id: true, birthday: true, gradeLevel: true }
  });
  const schoolGrades = ["Preschool", "Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade", "6th grade", "7th grade", "8th grade", "9th grade", "10th grade", "11th grade"];
  const updates = people.flatMap((person) => {
    const index = schoolGrades.indexOf(person.gradeLevel ?? "");
    if (index < 0) return [];
    return [{ id: person.id, gradeLevel: schoolGrades[index + 1] ?? "12th grade" }];
  });
  await db.$transaction(async (transaction) => {
    await transaction.membershipGradeAdvancementRun.create({ data: { schoolYear } });
    for (const update of updates) await transaction.membershipIndividual.update({ where: { id: update.id }, data: { gradeLevel: update.gradeLevel } });
    await transaction.membershipGradeAdvancementRun.update({ where: { schoolYear }, data: { updatedCount: updates.length } });
  });
  console.log(`Advanced ${updates.length} membership grade levels for school year ${schoolYear}.`);
} catch (error) {
  if (error instanceof Error && error.message.includes("Unique constraint")) {
    console.log(`Grade levels for school year ${schoolYear} were already advanced; no changes made.`);
    process.exit(0);
  }
  throw error;
} finally {
  await db.$disconnect();
}
