import { NextResponse } from "next/server";
import { listPageRevisions, restorePageRevision } from "@/lib/content";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await listPageRevisions(params.id));
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const input = await request.json().catch(() => ({}));
  if (typeof input.revisionId !== "string") return NextResponse.json({ error: "Revision ID is required." }, { status: 400 });
  if (input.expectedUpdatedAt !== undefined && (typeof input.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(input.expectedUpdatedAt)))) return NextResponse.json({ error: "Invalid page version." }, { status: 400 });
  try {
    return NextResponse.json(await restorePageRevision(params.id, input.revisionId, input.expectedUpdatedAt));
  } catch (error) {
    if (error instanceof Error && error.message === "Revision not found.") return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && error.message === "Page conflict.") return NextResponse.json({ error: "This page was changed in another editor. Reload before restoring a revision." }, { status: 409 });
    return unauthorizedResponse(error);
  }
}

function unauthorizedResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
