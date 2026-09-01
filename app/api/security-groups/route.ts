import { NextResponse } from "next/server";
import { createSecurityGroup } from "@/lib/users";
import type { Permission } from "@prisma/client";

const permissions = new Set<Permission>(["ACCESS_ADMIN", "EDIT_PAGES", "PUBLISH_PAGES", "MANAGE_MENUS", "MANAGE_USERS", "MANAGE_SETTINGS"]);

export async function POST(request: Request) {
  const input = await request.json();
  if (!input || typeof input.name !== "string" || typeof input.slug !== "string" || !Array.isArray(input.permissions) || !input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.permissions.some((permission: unknown) => !permissions.has(permission as Permission))) {
    return NextResponse.json({ error: "Invalid security group input." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createSecurityGroup(input), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    throw error;
  }
}

