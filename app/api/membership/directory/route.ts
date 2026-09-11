import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModuleSlugs } from "@/lib/modules";

export async function GET() {
  try {
    const [user, enabledModules] = await Promise.all([getCurrentUser(), getEnabledModuleSlugs()]);
    if (!user) return NextResponse.json({ error: "Sign in to view the member directory." }, { status: 401 });
    if (!enabledModules.includes("membership")) return NextResponse.json({ error: "The member directory is unavailable." }, { status: 404 });

    const members = await db.membershipIndividual.findMany({
      where: {
        status: "ACTIVE",
        directoryListed: true,
        family: { status: "ACTIVE", directoryListed: true }
      },
      orderBy: [{ family: { lastName: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        cellphone: true,
        family: {
          select: {
            lastName: true,
            familyNameOverride: true,
            phone: true,
            email: true,
            addressStreet: true,
            addressCity: true,
            addressState: true,
            addressZip: true
          }
        }
      }
    });

    return NextResponse.json({
      members: members.map((member) => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName ?? member.family.lastName,
        email: member.email ?? member.family.email,
        phone: member.cellphone ?? member.family.phone,
        familyName: member.family.familyNameOverride ?? `${member.family.lastName} family`,
        address: [member.family.addressStreet, [member.family.addressCity, member.family.addressState].filter(Boolean).join(", "), member.family.addressZip].filter(Boolean).join(" ")
      }))
    });
  } catch {
    return NextResponse.json({ error: "Unable to load the member directory." }, { status: 500 });
  }
}
