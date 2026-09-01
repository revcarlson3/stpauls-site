import { NextResponse } from "next/server";
import { createMenu, listMenus } from "@/lib/content";
import { parseMenuInput } from "@/lib/menu-input";

export async function GET() {
  try {
    return NextResponse.json(await listMenus());
  } catch (error) {
    return authResponse(error);
  }
}

export async function POST(request: Request) {
  const input = parseMenuInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid menu input." }, { status: 400 });

  try {
    const menu = await createMenu({ name: input.name, slug: input.slug });
    return NextResponse.json(menu, { status: 201 });
  } catch (error) {
    return authResponse(error);
  }
}

function authResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  throw error;
}

