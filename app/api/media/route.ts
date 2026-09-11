import { NextResponse } from "next/server";
import { backfillEmbeddedMediaMetadata, listMediaAssets } from "@/lib/media";
import { parseMediaFilter, parseMediaLinkedFilter } from "@/lib/media-input";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(await listMediaAssets({
      search: url.searchParams.get("search"),
      type: parseMediaFilter(url.searchParams.get("type")),
      linked: parseMediaLinkedFilter(url.searchParams.get("linked")),
      folder: url.searchParams.get("folder"),
      generated: url.searchParams.get("generated") === "generated" ? "generated" : url.searchParams.get("generated") === "standard" ? "standard" : "all"
    }));
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    if (input?.action !== "backfill-metadata") return NextResponse.json({ error: "Invalid media action." }, { status: 400 });
    return NextResponse.json(await backfillEmbeddedMediaMetadata());
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

function unauthorizedResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
