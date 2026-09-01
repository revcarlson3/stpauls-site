import { NextResponse } from "next/server";
import { createPage, listPages } from "@/lib/content";
import { parsePageInput } from "@/lib/page-input";

export async function GET() {
  try {
    return NextResponse.json(await listPages());
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function POST(request: Request) {
  const input = parsePageInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid page input." }, { status: 400 });

  try {
    return NextResponse.json(await createPage(input), { status: 201 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

function unauthorizedResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  throw error;
}

