import { NextResponse } from "next/server";
import { getSiteLayout, saveSiteLayout, type FooterLayout, type HeaderLayout } from "@/lib/site-layout";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("MANAGE_SETTINGS");
    return NextResponse.json(await getSiteLayout());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  const header = input?.header;
  const footer = input?.footer;
  if (!header || !footer || !["compact", "standard", "tall"].includes(header.height) || typeof header.background !== "string" || typeof header.textColor !== "string" || typeof header.sticky !== "boolean" || (header.menuId !== null && typeof header.menuId !== "string") || !["simple", "columns", "centered"].includes(footer.style) || typeof footer.background !== "string" || typeof footer.textColor !== "string" || typeof footer.copyright !== "string" || typeof footer.credit !== "string" || !Array.isArray(footer.columns)) {
    return NextResponse.json({ error: "Invalid site layout." }, { status: 400 });
  }
  try {
    await saveSiteLayout(header as HeaderLayout, footer as FooterLayout);
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}
