import { GRADE_LEVELS } from "@/lib/membership-options";

const SCHOOL_GRADE_LEVELS = GRADE_LEVELS.slice(0, 14);

function ageOnSeptemberFirst(birthday: Date, referenceDate = new Date()) {
  const schoolYear = referenceDate.getMonth() < 8 ? referenceDate.getFullYear() - 1 : referenceDate.getFullYear();
  const schoolYearStart = new Date(schoolYear, 8, 1);
  return schoolYear - birthday.getFullYear() - (new Date(schoolYear, birthday.getMonth(), birthday.getDate()) > schoolYearStart ? 1 : 0);
}

export function estimateGradeLevel(birthday: Date, referenceDate = new Date()) {
  const age = ageOnSeptemberFirst(birthday, referenceDate);
  if (age <= 4) return "Preschool";
  if (age === 5) return "Kindergarten";
  if (age <= 17) return `${age - 5}th grade`.replace(/^1th/, "1st").replace(/^2th/, "2nd").replace(/^3th/, "3rd");
  if (age <= 21) return "College";
  return "Adult";
}

export function advanceGradeLevel(gradeLevel: string | null) {
  const index = SCHOOL_GRADE_LEVELS.indexOf(gradeLevel as (typeof SCHOOL_GRADE_LEVELS)[number]);
  if (index < 0 || index === SCHOOL_GRADE_LEVELS.length - 1) return null;
  return SCHOOL_GRADE_LEVELS[index + 1];
}

export function isSchoolGradeLevel(gradeLevel: string | null) {
  return SCHOOL_GRADE_LEVELS.includes(gradeLevel as (typeof SCHOOL_GRADE_LEVELS)[number]);
}
