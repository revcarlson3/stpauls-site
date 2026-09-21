import { NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireGlobalAdmin();
    return NextResponse.json(await db.church.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, status: true, lifecycleStatus: true, onboardingStatus: true } }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load sites." }, { status: 500 });
  }
}
