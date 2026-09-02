import { NextResponse } from "next/server";
import { deleteSecurityGroup, updateSecurityGroup } from "@/lib/users";
import type { Permission } from "@prisma/client";

const permissions = new Set<Permission>(["ACCESS_ADMIN", "EDIT_PAGES", "PUBLISH_PAGES", "MANAGE_MENUS", "MANAGE_USERS", "MANAGE_SETTINGS", "MANAGE_MODULES", "MANAGE_MEMBERSHIP", "MANAGE_EVENTS", "MANAGE_GIVING", "MANAGE_ACCOUNTING", "MANAGE_SERVICES"]);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = await request.json();
  if (!input || typeof input.name !== "string" || !input.name.trim() || !Array.isArray(input.permissions) || input.permissions.some((permission: unknown) => !permissions.has(permission as Permission))) {
    return NextResponse.json({ error: "Invalid security group input." }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateSecurityGroup(params.id, { name: input.name, permissions: input.permissions }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to update the security group." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteSecurityGroup(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("cannot be deleted")) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === "Security group not found.") return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Unable to remove the security group." }, { status: 500 });
  }
}
