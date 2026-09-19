import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGlobalAdmin } from "@/lib/global-admin";

export async function GET() {
  try {
    await requireGlobalAdmin({ selectedChurch: true });
    return NextResponse.json(await db.securityGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("site must be selected")) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to load security groups." }, { status: 500 });
  }
}
