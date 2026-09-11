import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const id = url.searchParams.get("id")?.trim() ?? "";
    const targetType = url.searchParams.get("targetType")?.trim().toUpperCase() ?? "ALL";

    if (!id && search.length < 3) {
      return NextResponse.json({ targets: [] });
    }

    const targets: { id: string; targetType: "INDIVIDUAL" | "FAMILY"; label: string; detail: string }[] = [];
    if (targetType === "ALL" || targetType === "INDIVIDUAL") {
      const individuals = await db.membershipIndividual.findMany({
        where: {
          status: { not: "REMOVED" },
          ...(id ? { id } : {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { family: { lastName: { contains: search, mode: "insensitive" } } }
            ]
          })
        },
        select: { id: true, firstName: true, lastName: true, family: { select: { lastName: true } }, status: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 20
      });
      targets.push(...individuals.map((individual) => ({
        id: individual.id,
        targetType: "INDIVIDUAL" as const,
        label: `${individual.firstName}${individual.lastName ? ` ${individual.lastName}` : ""}`,
        detail: `${individual.family.lastName} family · ${individual.status.toLowerCase()}`
      })));
    }
    if (targetType === "ALL" || targetType === "FAMILY") {
      const families = await db.membershipFamily.findMany({
        where: {
          status: { not: "REMOVED" },
          ...(id ? { id } : { lastName: { contains: search, mode: "insensitive" } })
        },
        select: { id: true, lastName: true, status: true },
        orderBy: { lastName: "asc" },
        take: 20
      });
      targets.push(...families.map((family) => ({
        id: family.id,
        targetType: "FAMILY" as const,
        label: `${family.lastName} family`,
        detail: `Family · ${family.status.toLowerCase()}`
      })));
    }
    return NextResponse.json({ targets });
  } catch {
    return NextResponse.json({ error: "Unable to search workflow targets." }, { status: 403 });
  }
}
