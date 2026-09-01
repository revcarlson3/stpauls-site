import { NextResponse } from "next/server";
import { deleteUser, updateUserAccount } from "@/lib/users";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = await request.json();
  if (!input || typeof input.name !== "string" || input.name.trim().length < 2 || typeof input.email !== "string" || !input.email.includes("@") || (input.password !== undefined && (typeof input.password !== "string" || input.password.length < 12)) || (input.groupId !== null && typeof input.groupId !== "string")) {
    return NextResponse.json({ error: "Provide a valid name, email, group, and optional password of at least 12 characters." }, { status: 400 });
  }

  try {
    return NextResponse.json(await updateUserAccount({ id: params.id, name: input.name, email: input.email, password: input.password, groupId: input.groupId }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
    return NextResponse.json({ error: "Unable to update this user." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteUser(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("cannot delete")) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to delete this user." }, { status: 500 });
  }
}
