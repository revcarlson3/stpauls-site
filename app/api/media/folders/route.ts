import { NextResponse } from "next/server";
import { listMediaFolders, mergeMediaFolders } from "@/lib/media";

export async function GET() {
  try {
    return NextResponse.json(await listMediaFolders());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    if (!input || typeof input.from !== "string" || typeof input.to !== "string") return NextResponse.json({ error: "Choose a source and destination folder." }, { status: 400 });
    return NextResponse.json(await mergeMediaFolders(input.from, input.to));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof Error && error.message === "Choose two different valid folders.") return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
