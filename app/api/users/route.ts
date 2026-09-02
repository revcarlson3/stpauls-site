import { NextResponse } from "next/server";
import { createUser, listUsers } from "@/lib/users";
import type { Role } from "@/lib/auth";

export async function GET() {
  try {
    return NextResponse.json(await listUsers());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const input = await request.json();
  if (
    !input ||
    typeof input.email !== "string" ||
    typeof input.name !== "string" ||
    typeof input.password !== "string" ||
    !isRole(input.role) ||
    (input.groupId !== undefined && input.groupId !== null && typeof input.groupId !== "string") ||
    !input.email.includes("@") ||
    input.name.trim().length < 2 ||
    input.password.length < 1
  ) {
    return NextResponse.json({ error: "Provide a valid email, name, role, and password." }, { status: 400 });
  }

  try {
    return NextResponse.json(await createUser({ ...input, groupId: input.groupId ?? null }), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Invalid security group.") return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message.startsWith("Password")) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}

function isRole(value: unknown): value is Role {
  return value === "viewer" || value === "editor" || value === "admin";
}
