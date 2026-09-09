import { db } from "@/lib/db";
import { advanceGradeLevel, estimateGradeLevel, isSchoolGradeLevel } from "@/lib/membership-grade-levels";

export function schoolYearForDate(referenceDate = new Date()) {
  return referenceDate.getMonth() < 8 ? referenceDate.getFullYear() - 1 : referenceDate.getFullYear();
}

export async function advanceMembershipGrades(referenceDate = new Date()) {
  const schoolYear = schoolYearForDate(referenceDate);
  try {
    const result = await db.$transaction(async (transaction) => {
      await transaction.membershipGradeAdvancementRun.create({ data: { schoolYear } });
      const people = await transaction.membershipIndividual.findMany({
        where: { status: { not: "REMOVED" } },
        select: { id: true, birthday: true, gradeLevel: true }
      });
      const updates = people.flatMap((person) => {
        const nextGrade = person.gradeLevel
          ? (isSchoolGradeLevel(person.gradeLevel) ? advanceGradeLevel(person.gradeLevel) : null)
          : estimateGradeLevel(person.birthday, referenceDate);
        return nextGrade && nextGrade !== person.gradeLevel ? [{ id: person.id, gradeLevel: nextGrade }] : [];
      });
      for (const update of updates) {
        await transaction.membershipIndividual.update({ where: { id: update.id }, data: { gradeLevel: update.gradeLevel } });
      }
      await transaction.membershipGradeAdvancementRun.update({ where: { schoolYear }, data: { updatedCount: updates.length } });
      return { schoolYear, updated: updates.length, alreadyRun: false };
    });
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { schoolYear, updated: 0, alreadyRun: true };
    }
    throw error;
  }
}
