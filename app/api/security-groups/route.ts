import { NextResponse } from "next/server";
import { createSecurityGroup, listSecurityGroups } from "@/lib/users";
import type { Permission } from "@prisma/client";

const permissions = new Set<Permission>(["ACCESS_ADMIN", "EDIT_PAGES", "PUBLISH_PAGES", "MANAGE_MENUS", "MANAGE_USERS", "MANAGE_SETTINGS", "MANAGE_MODULES", "MANAGE_MEMBERSHIP", "MANAGE_EVENTS", "MANAGE_GIVING", "MANAGE_ACCOUNTING", "MANAGE_SERVICES"]);

function isValidPermissions(value: unknown): value is Permission[] {
  return Array.isArray(value) && value.every((permission) => permissions.has(permission as Permission));
}

export async function GET() {
  try {
    return NextResponse.json(await listSecurityGroups());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    throw error;
  }
}

export async function POST(request: Request) {
  const input = await request.json();
  if (!input || typeof input.name !== "string" || typeof input.slug !== "string" || !isValidPermissions(input.permissions) || !input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return NextResponse.json({ error: "Invalid security group input." }, { status: 400 });
  }

  try {
    return NextResponse.json(await createSecurityGroup(input), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "A security group with that slug already exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the security group." }, { status: 500 });
  }
}
