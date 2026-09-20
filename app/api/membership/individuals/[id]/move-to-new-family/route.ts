import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { membershipAuditDetails } from "@/lib/membership-timeline";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    if (!input || typeof input.lastName !== "string" || !input.lastName.trim()) {
      return NextResponse.json({ error: "A family last name is required." }, { status: 400 });
    }
    const [individual, role, highest] = await Promise.all([
      db.membershipIndividual.findUnique({ where: { id: params.id }, select: { id: true, firstName: true, familyId: true, status: true } }),
      db.membershipFamilyRole.findFirst({ where: { churchId: user.churchId!, slug: "head-of-household" }, select: { id: true } }),
      db.membershipIndividual.aggregate({ _max: { memberNumber: true } })
    ]);
    if (!individual || individual.status === "REMOVED") return NextResponse.json({ error: "Individual not found." }, { status: 404 });
    if (!role) return NextResponse.json({ error: "The Head of Household role is unavailable." }, { status: 503 });

    const result = await db.$transaction(async (transaction) => {
      const family = await transaction.membershipFamily.create({
        data: {
          churchId: user.churchId!,
          lastName: input.lastName.trim(),
          phone: typeof input.phone === "string" ? input.phone.trim() || null : null,
          email: typeof input.email === "string" ? input.email.trim().toLowerCase() || null : null,
          addressStreet: typeof input.addressStreet === "string" ? input.addressStreet.trim() || null : null,
          addressCity: typeof input.addressCity === "string" ? input.addressCity.trim() || null : null,
          addressState: typeof input.addressState === "string" ? input.addressState.trim() || null : null,
          addressZip: typeof input.addressZip === "string" ? input.addressZip.trim() || null : null
        }
      });
      await transaction.membershipIndividual.update({ where: { id: individual.id }, data: { familyId: family.id, familyRoleId: role.id } });
      return family;
    });
    await logAudit({
      activityType: "membership-individual-updated",
      summary: `Moved ${individual.firstName} to a new family.`,
      details: membershipAuditDetails({ individualId: individual.id, familyId: result.id }),
      actorId: user.id
    });
    return NextResponse.json({ familyId: result.id });
  } catch (error) {
    return apiErrorResponse(error, "Unable to move individual to a new family.");
  }
}
