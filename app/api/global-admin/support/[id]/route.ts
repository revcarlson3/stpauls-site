import { NextResponse } from "next/server";
import { addSelectedSiteSupportReply, getSelectedSiteSupportTicket, updateSelectedSiteSupportTicket } from "@/lib/global-admin-support";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const ticket = await getSelectedSiteSupportTicket(params.id, true);
    if (!ticket) return NextResponse.json({ error: "Support ticket not found." }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load support ticket." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const input = await request.json().catch(() => ({}));
  try {
    const ticket = await updateSelectedSiteSupportTicket(params.id, input, true);
    if (!ticket) return NextResponse.json({ error: "Support ticket not found." }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "The selected site is not active.") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "Support ticket fields are invalid.") return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === "The assignee must be an active platform administrator.") return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update support ticket." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const input = form ? null : await request.json().catch(() => ({}));
    const body = String(form?.get("body") ?? input?.body ?? "");
    const files = form ? form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0) : [];
    const messageId = await addSelectedSiteSupportReply(params.id, body, files, true);
    if (!messageId) return NextResponse.json({ error: "Support ticket not found." }, { status: 404 });
    return NextResponse.json({ id: messageId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "The selected site is not active.") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && (error.message === "Support reply is invalid." || error.message.includes("Attachments"))) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to add support reply." }, { status: 500 });
  }
}
