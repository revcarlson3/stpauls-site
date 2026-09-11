import { NextResponse } from "next/server";
import { searchGoogleFonts } from "@/lib/google-fonts";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ fonts: await searchGoogleFonts(query) });
  } catch {
    return NextResponse.json({ error: "Unable to load Google Fonts." }, { status: 502 });
  }
}
