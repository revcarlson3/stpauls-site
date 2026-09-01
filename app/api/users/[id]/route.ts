import { NextResponse } from "next/server";
import { assignUserGroup } from "@/lib/users";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = await request.json();
  if (!input || (input.groupId !== null && typeof input.groupId !== "string")) {
    return NextResponse.json({ error: "Invalid group assignment." }, { status: 400 });
  }
  try {
    return NextResponse.json(await assignUserGroup(params.id, input.groupId));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to update this user." }, { status: 500 });
  }
}
