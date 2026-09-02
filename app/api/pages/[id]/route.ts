import { NextResponse } from "next/server";
import { archivePage, deletePage, getPage, publishPage, setHomePage, updatePage } from "@/lib/content";
import { parsePageInput } from "@/lib/page-input";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const page = await getPage(params.id);
    return page ? NextResponse.json(page) : NextResponse.json({ error: "Page not found." }, { status: 404 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = parsePageInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid page input." }, { status: 400 });
  try {
    return NextResponse.json(await updatePage(params.id, input));
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid menu assignment.") return NextResponse.json({ error: error.message }, { status: 400 });
    return unauthorizedResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const input = await request.json().catch(() => ({}));
  try {
    if (input.action === "publish") return NextResponse.json(await publishPage(params.id));
    if (input.action === "archive") return NextResponse.json(await archivePage(params.id));
    if (input.action === "home") return NextResponse.json(await setHomePage(params.id));
    return NextResponse.json({ error: "Unknown page action." }, { status: 400 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deletePage(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

function unauthorizedResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
