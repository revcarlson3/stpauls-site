import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { CustomFieldValidationError, saveCustomFieldValues, validateCustomFieldValues } from "@/lib/membership-custom-fields";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const memberType = url.searchParams.get("memberType")?.trim() ?? "";
    const id = url.searchParams.get("id");
    const members = await db.membershipIndividual.findMany({
      where: {
        status: { not: "REMOVED" },
        ...(memberType ? { memberType: { slug: memberType } } : {}),
        ...(search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { family: { lastName: { contains: search, mode: "insensitive" } } }] } : {})
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { family: true, memberType: true, familyRole: true, customValues: { where: { definition: { isActive: true } }, select: { definitionId: true, value: true } } },
      take: 200
    });
    const selected = id ? members.find((member) => member.id === id) ?? null : members[0] ?? null;
    const types = await db.membershipMemberType.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
    return NextResponse.json({
      types,
      members: members.map((member) => ({ id: member.id, firstName: member.firstName, middleName: member.middleName, lastName: member.lastName, familyLastName: member.family.lastName, memberNumber: member.memberNumber, memberType: member.memberType.name, status: member.status })),
      selected
    });
  } catch {
    return NextResponse.json({ error: "Unable to load membership records." }, { status: 403 });
  }
}

export async function POST(request: Request) {
    try {
      const user = await requirePermission("MANAGE_MEMBERSHIP");
      await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
      const input = await request.json();
      if (!input || typeof input.lastName !== "string" || !input.lastName.trim() || typeof input.firstName !== "string" || !input.firstName.trim() || typeof input.phone !== "string" || !input.phone.trim() || typeof input.email !== "string" || !input.email.trim() || !["ACTIVE", "INACTIVE"].includes(input.status)) {
        return NextResponse.json({ error: "Last name, first name, phone, email, and status are required." }, { status: 400 });
      }
      const customFields = await validateCustomFieldValues(input.customFieldValues, "FAMILY");
      const possibleDuplicates = await db.membershipFamily.findMany({
        where: {
          OR: [
            { email: { equals: input.email.trim(), mode: "insensitive" } },
            { AND: [{ lastName: { equals: input.lastName.trim(), mode: "insensitive" } }, { individuals: { some: { firstName: { equals: input.firstName.trim(), mode: "insensitive" }, familyRole: { slug: "head-of-household" } } } }] }
          ],
          status: { not: "REMOVED" }
        },
        select: { id: true, lastName: true, email: true, individuals: { where: { familyRole: { slug: "head-of-household" } }, select: { firstName: true }, take: 1 } },
        take: 5
      });
      if (possibleDuplicates.length && input.confirmDuplicate !== true) {
        return NextResponse.json({ error: "A possible matching family was found. Review it before continuing.", duplicate: true, candidates: possibleDuplicates.map((family) => ({ id: family.id, name: `${family.lastName}, ${family.individuals[0]?.firstName ?? "Unknown"}`, email: family.email })) }, { status: 409 });
      }
      const [role, type, highest] = await Promise.all([
        db.membershipFamilyRole.findUnique({ where: { slug: "head-of-household" } }),
        db.membershipMemberType.findFirst({ orderBy: { name: "asc" } }),
        db.membershipIndividual.aggregate({ _max: { memberNumber: true } })
      ]);
      if (!role || !type) return NextResponse.json({ error: "Membership reference data has not been seeded." }, { status: 503 });
      const family = await db.$transaction(async (transaction) => {
        const created = await transaction.membershipFamily.create({
          data: {
            lastName: input.lastName.trim(), phone: input.phone.trim(), email: input.email.trim().toLowerCase(), status: input.status,
            addressStreet: typeof input.addressStreet === "string" ? input.addressStreet.trim() : null,
            addressCity: typeof input.addressCity === "string" ? input.addressCity.trim() : null,
            addressState: typeof input.addressState === "string" ? input.addressState.trim() : null,
            addressZip: typeof input.addressZip === "string" ? input.addressZip.trim() : null,
            individuals: { create: { firstName: input.firstName.trim(), memberNumber: (highest._max.memberNumber ?? 0) + 1, birthday: new Date(input.birthday), gender: input.gender === "FEMALE" ? "FEMALE" : "MALE", maritalStatus: typeof input.maritalStatus === "string" && input.maritalStatus ? input.maritalStatus : "Unspecified", memberTypeId: type.id, familyRoleId: role.id, status: input.status } }
          },
          include: { individuals: true }
        });
        await saveCustomFieldValues(transaction, "FAMILY", created.id, customFields);
        return created;
      });
      await logAudit({ activityType: "membership-family-created", summary: `Created membership family ${family.lastName}.`, actorId: user.id });
      return NextResponse.json({ family }, { status: 201 });
    } catch (error) {
      if (error instanceof CustomFieldValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ error: "Unable to create membership family." }, { status: 500 });
  }
}
