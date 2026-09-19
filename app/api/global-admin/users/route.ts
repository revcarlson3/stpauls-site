import { NextResponse } from "next/server";
import { listSelectedChurchUsers, updateSelectedChurchUser } from "@/lib/global-admin-users";
import type { Role } from "@prisma/client";

export async function GET() {
  try { return NextResponse.json(await listSelectedChurchUsers()); }
  catch (error) { return respondError(error, "Unable to load selected-site users."); }
}

export async function PATCH(request: Request) {
  const input = await request.json().catch(() => ({}));
  if (!input || typeof input.userId !== "string" || (input.isActive !== undefined && typeof input.isActive !== "boolean") || (input.role !== undefined && !["viewer", "editor", "admin"].includes(input.role)) || (input.groupId !== undefined && input.groupId !== null && typeof input.groupId !== "string")) return NextResponse.json({ error: "Provide a valid user access update." }, { status: 400 });
  try { return NextResponse.json(await updateSelectedChurchUser(input as { userId: string; isActive?: boolean; role?: Role; groupId?: string | null })); }
  catch (error) { return respondError(error, "Unable to update selected-site user."); }
}

function respondError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
  if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
  if (error instanceof Error && (error.message.includes("selected user") || error.message.includes("Security group"))) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}
