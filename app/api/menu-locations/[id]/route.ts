import { NextResponse } from "next/server";
import { updateMenuLocation } from "@/lib/content";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = await request.json().catch(() => null) as { menuId?: unknown } | null;
  if (!input || (input.menuId !== null && typeof input.menuId !== "string")) return NextResponse.json({ error: "Invalid menu location input." }, { status: 400 });
  try {
    return NextResponse.json(await updateMenuLocation(params.id, input.menuId as string | null));
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid menu assignment.") return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}
