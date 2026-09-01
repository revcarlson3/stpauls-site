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
    !input.email.includes("@") ||
    input.name.trim().length < 2 ||
    input.password.length < 12
  ) {
    return NextResponse.json({ error: "Provide a valid email, name, role, and password of at least 12 characters." }, { status: 400 });
  }

  try {
    return NextResponse.json(await createUser(input), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }
    throw error;
  }
}

function isRole(value: unknown): value is Role {
  return value === "viewer" || value === "editor" || value === "admin";
}
