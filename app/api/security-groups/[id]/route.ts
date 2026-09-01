import { NextResponse } from "next/server";
import { updateSecurityGroup } from "@/lib/users";
import type { Permission } from "@prisma/client";

const permissions = new Set<Permission>(["ACCESS_ADMIN", "EDIT_PAGES", "PUBLISH_PAGES", "MANAGE_MENUS", "MANAGE_USERS", "MANAGE_SETTINGS"]);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = await request.json();
  if (!input || typeof input.name !== "string" || !input.name.trim() || !Array.isArray(input.permissions) || input.permissions.some((permission: unknown) => !permissions.has(permission as Permission))) {
    return NextResponse.json({ error: "Invalid security group input." }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateSecurityGroup(params.id, { name: input.name, permissions: input.permissions }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    throw error;
  }
}
