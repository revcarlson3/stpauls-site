import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

const defaultCategories = ["Infant", "Toddler", "Preschool", "Elementary", "Youth", "Young Adult", "Adult", "Senior"];

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
}

async function categories() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { membershipAgeCategories: true } });
  return Array.isArray(settings?.membershipAgeCategories)
    ? settings.membershipAgeCategories.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : defaultCategories;
}

export async function GET() {
  try {
    await authorize();
    return NextResponse.json({ categories: await categories() });
  } catch {
    return NextResponse.json({ error: "Unable to load age categories." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 80) return NextResponse.json({ error: "Enter an age category name." }, { status: 400 });
    const current = await categories();
    if (current.some((category) => category.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: "That age category already exists." }, { status: 409 });
    const next = [...current, name];
    await db.securitySettings.upsert({ where: { id: 1 }, create: { id: 1, membershipAgeCategories: next }, update: { membershipAgeCategories: next } });
    return NextResponse.json({ categories: next }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to add age category." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await authorize();
    const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
    const current = await categories();
    if (!name || !current.includes(name)) return NextResponse.json({ error: "Age category not found." }, { status: 404 });
    const assigned = await db.membershipIndividual.count({ where: { ageCategoryOverride: name } });
    if (assigned) return NextResponse.json({ error: `This age category is assigned to ${assigned} member${assigned === 1 ? "" : "s"}.` }, { status: 409 });
    const next = current.filter((category) => category !== name);
    if (!next.length) return NextResponse.json({ error: "Keep at least one age category." }, { status: 400 });
    await db.securitySettings.update({ where: { id: 1 }, data: { membershipAgeCategories: next } });
    return NextResponse.json({ categories: next });
  } catch {
    return NextResponse.json({ error: "Unable to remove age category." }, { status: 400 });
  }
}
