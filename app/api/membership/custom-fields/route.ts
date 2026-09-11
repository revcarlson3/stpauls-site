import { NextResponse } from "next/server";
import { MembershipCustomFieldType } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

const fieldTypes = ["TEXT", "TEXTAREA", "SELECT", "RADIO", "CHECKBOX", "DATE", "PHONE", "EMAIL"];
const targets = ["INDIVIDUAL", "FAMILY"];

async function authorize(userId: string) {
  await requireEnabledModule("membership", userId, "MANAGE_MEMBERSHIP");
}

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await authorize(user.id);
    const url = new URL(request.url);
    const appliesTo = url.searchParams.get("appliesTo");
    const activeOnly = url.searchParams.get("active") === "1";
    const fields = await db.membershipCustomFieldDefinition.findMany({
      where: {
        ...(targets.includes(appliesTo as (typeof targets)[number]) ? { appliesTo: appliesTo as string } : {}),
        ...(activeOnly ? { isActive: true } : {})
      },
      orderBy: [{ appliesTo: "asc" }, { position: "asc" }, { name: "asc" }]
    });
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json({ error: "Unable to load custom fields." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await authorize(user.id);
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const slugSource = typeof input?.slug === "string" && input.slug.trim() ? input.slug : name;
    const slug = slugSource.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const appliesTo = typeof input?.appliesTo === "string" ? input.appliesTo : "";
    const type = typeof input?.type === "string" ? input.type : "";
    if (!name || !slug || !targets.includes(appliesTo) || !fieldTypes.includes(type)) return NextResponse.json({ error: "Name, type, and target are required." }, { status: 400 });
    const options: string[] = Array.isArray(input.options) ? input.options.filter((option: unknown): option is string => typeof option === "string" && Boolean(option.trim())).map((option: string) => option.trim()) : [];
    if (["SELECT", "RADIO"].includes(type) && !options.length) return NextResponse.json({ error: "Select and radio fields require at least one option." }, { status: 400 });
    if (options.some((option) => option.length > 200) || options.length > 100) return NextResponse.json({ error: "Custom field options are too long or numerous." }, { status: 400 });
    const field = await db.membershipCustomFieldDefinition.create({ data: { name, slug, type: type as MembershipCustomFieldType, appliesTo, options: options.length ? options : undefined, isRequired: input.isRequired === true } });
    return NextResponse.json({ field }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create custom field. Slugs must be unique." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await authorize(user.id);
    const input = await request.json();
    if (typeof input?.id !== "string" || typeof input?.isActive !== "boolean") return NextResponse.json({ error: "Invalid custom field update." }, { status: 400 });
    const field = await db.membershipCustomFieldDefinition.update({ where: { id: input.id }, data: { isActive: input.isActive } });
    return NextResponse.json({ field });
  } catch {
    return NextResponse.json({ error: "Unable to update custom field." }, { status: 400 });
  }
}
