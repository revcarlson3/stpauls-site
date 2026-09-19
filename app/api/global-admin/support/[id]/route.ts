import { NextResponse } from "next/server";
import { getSelectedSiteSupportTicket, updateSelectedSiteSupportTicket } from "@/lib/global-admin-support";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const ticket = await getSelectedSiteSupportTicket(params.id);
    if (!ticket) return NextResponse.json({ error: "Support ticket not found." }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to load support ticket." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const input = await request.json().catch(() => ({}));
  try {
    const ticket = await updateSelectedSiteSupportTicket(params.id, input);
    if (!ticket) return NextResponse.json({ error: "Support ticket not found." }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "The selected site is not active.") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "Support ticket fields are invalid.") return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === "The assignee must be an active platform administrator.") return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update support ticket." }, { status: 500 });
  }
}
