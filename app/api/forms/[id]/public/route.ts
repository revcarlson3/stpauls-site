import { NextResponse } from "next/server";
import { getPublicForm } from "@/lib/forms";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const form = await getPublicForm(params.id);
  return form ? NextResponse.json(form, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Form not found." }, { status: 404 });
}
