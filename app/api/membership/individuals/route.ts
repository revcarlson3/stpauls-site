import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const families = await db.membershipFamily.findMany({
      where: { status: { not: "REMOVED" } },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, lastName: true, individuals: { where: { familyRole: { slug: "head-of-household" } }, select: { firstName: true }, take: 1 } }
    });
    return NextResponse.json({ families: families.map((family) => ({ id: family.id, name: `${family.lastName}, ${family.individuals[0]?.firstName ?? "Unknown"}` })) });
  } catch {
    return NextResponse.json({ error: "Unable to load families." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const birthday = typeof input?.birthday === "string" ? new Date(input.birthday) : new Date("invalid");
    if (!input || typeof input.familyId !== "string" || typeof input.firstName !== "string" || !input.firstName.trim() || Number.isNaN(birthday.getTime()) || typeof input.memberTypeId !== "string" || typeof input.familyRoleId !== "string" || !["MALE", "FEMALE"].includes(input.gender) || typeof input.maritalStatus !== "string" || !input.maritalStatus.trim() || !["ACTIVE", "INACTIVE"].includes(input.status)) {
      return NextResponse.json({ error: "Family, first name, birthday, member type, family role, gender, marital status, and status are required." }, { status: 400 });
    }
    const [family, role, type, highest] = await Promise.all([
      db.membershipFamily.findUnique({ where: { id: input.familyId }, select: { id: true, status: true } }),
      db.membershipFamilyRole.findUnique({ where: { id: input.familyRoleId }, select: { id: true } }),
      db.membershipMemberType.findUnique({ where: { id: input.memberTypeId }, select: { id: true } }),
      db.membershipIndividual.aggregate({ _max: { memberNumber: true } })
    ]);
    if (!family || family.status === "REMOVED" || !role || !type) return NextResponse.json({ error: "The selected family or membership reference is unavailable." }, { status: 400 });
    const individual = await db.membershipIndividual.create({ data: {
      familyId: family.id, firstName: input.firstName.trim(), middleName: typeof input.middleName === "string" ? input.middleName.trim() || null : null, lastName: typeof input.lastName === "string" ? input.lastName.trim() || null : null,
      birthday, memberNumber: (highest._max.memberNumber ?? 0) + 1, gender: input.gender, maritalStatus: input.maritalStatus.trim(), status: input.status, memberTypeId: type.id, familyRoleId: role.id,
      ageCategoryOverride: typeof input.ageCategoryOverride === "string" ? input.ageCategoryOverride.trim() || null : null, cellphone: typeof input.cellphone === "string" ? input.cellphone.trim() || null : null, otherPhone: typeof input.otherPhone === "string" ? input.otherPhone.trim() || null : null, otherPhoneType: typeof input.otherPhoneType === "string" ? input.otherPhoneType.trim() || null : null, email: typeof input.email === "string" ? input.email.trim().toLowerCase() || null : null, gradeLevel: typeof input.gradeLevel === "string" ? input.gradeLevel.trim() || null : null, weddingDate: typeof input.weddingDate === "string" && input.weddingDate ? new Date(input.weddingDate) : null
    } });
    await logAudit({ activityType: "membership-individual-created", summary: `Created membership individual ${individual.firstName}.`, actorId: user.id });
    return NextResponse.json({ individual }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create membership individual." }, { status: 500 });
  }
}
