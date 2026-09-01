import { NextResponse } from "next/server";
import { updatePage } from "@/lib/content";
import { parsePageInput } from "@/lib/page-input";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = parsePageInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid page input." }, { status: 400 });

  try {
    return NextResponse.json(await updatePage(params.id, input));
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid menu assignment.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    throw error;
  }
}
