import { NextResponse } from "next/server";
import { createWidget, listWidgets } from "@/lib/content";
import { parseWidgetInput } from "@/lib/widget-input";

export async function GET() {
  try { return NextResponse.json(await listWidgets()); }
  catch (error) { return authResponse(error); }
}

export async function POST(request: Request) {
  const input = parseWidgetInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid widget input." }, { status: 400 });
  try { return NextResponse.json(await createWidget(input), { status: 201 }); }
  catch (error) { return authResponse(error); }
}

function authResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
