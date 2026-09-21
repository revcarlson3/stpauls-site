import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("ACCESS_ADMIN");
    const users = await db.user.findMany({
      where: {
        isActive: true,
        group: { permissions: { some: { permission: "ACCESS_ADMIN" } } }
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true }
    });
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Unable to load report recipients." }, { status: 403 });
  }
}
