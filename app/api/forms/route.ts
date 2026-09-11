import { NextResponse } from "next/server";
import { createForm, formStatus, listForms } from "@/lib/forms";
import { normalizeFormDefinition } from "@/lib/form-config";

export async function GET() {
  try {
    return NextResponse.json(await listForms());
  } catch (error) {
    return unauthorized(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid form input." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.name !== "string" || !input.name.trim() || typeof input.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) return NextResponse.json({ error: "A valid name and slug are required." }, { status: 400 });
  try {
    return NextResponse.json(await createForm({ name: input.name.trim(), slug: input.slug, status: formStatus(input.status), enabled: input.enabled !== false, definition: normalizeFormDefinition(input.definition), notificationSettings: asObject(input.notificationSettings), exportSettings: asObject(input.exportSettings) }), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "That form slug is already in use." }, { status: 409 });
    return unauthorized(error);
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function unauthorized(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
