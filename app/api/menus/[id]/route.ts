import { NextResponse } from "next/server";
import { getMenu, updateMenuItems } from "@/lib/content";
import { parseMenuInput } from "@/lib/menu-input";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const menu = await getMenu(params.id);
    return menu ? NextResponse.json(menu) : NextResponse.json({ error: "Menu not found." }, { status: 404 });
  } catch (error) {
    return authResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = parseMenuInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid menu input." }, { status: 400 });
  try {
    return NextResponse.json(await updateMenuItems(params.id, input));
  } catch (error) {
    return authResponse(error);
  }
}

function authResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
