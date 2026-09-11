import { NextResponse } from "next/server";
import { deleteWidget, updateWidget } from "@/lib/content";
import { parseWidgetInput } from "@/lib/widget-input";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = parseWidgetInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid widget input." }, { status: 400 });
  try { return NextResponse.json(await updateWidget(params.id, input)); }
  catch (error) { return authResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json(await deleteWidget(params.id)); }
  catch (error) { return authResponse(error); }
}

function authResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
