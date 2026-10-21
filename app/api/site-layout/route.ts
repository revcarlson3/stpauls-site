import { NextResponse } from "next/server";
import { getSiteLayout, normalizeFooterLayout, saveSiteLayout, type HeaderLayout } from "@/lib/site-layout";
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
  const preHeader = header?.preHeader;
  const validMenuIds = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
  if (!header || !footer || !["compact", "standard", "tall"].includes(header.height) || typeof header.background !== "string" || typeof header.textColor !== "string" || typeof header.sticky !== "boolean" || typeof header.stylistic !== "boolean" || (header.menuId !== null && typeof header.menuId !== "string") || !validMenuIds(header.accountMenuIds) || !validMenuIds(header.membershipMenuIds) || !validMenuIds(header.logoutMenuIds) || (preHeader !== undefined && (!preHeader || typeof preHeader !== "object" || Array.isArray(preHeader) || typeof preHeader.enabled !== "boolean" || typeof preHeader.background !== "string" || !["compact", "standard", "tall"].includes(preHeader.height) || typeof preHeader.html !== "string" || (preHeader.menuId !== null && typeof preHeader.menuId !== "string"))) || !["simple", "columns", "centered"].includes(footer.style) || typeof footer.background !== "string" || typeof footer.textColor !== "string" || typeof footer.copyright !== "string" || typeof footer.credit !== "string" || !Array.isArray(footer.columns) || footer.columns.length < 2 || footer.columns.length > 5 || footer.columns.some((column: unknown) => !column || typeof column !== "object" || Array.isArray(column) || typeof (column as { heading?: unknown }).heading !== "string" || ((column as { widgetId?: unknown }).widgetId !== null && typeof (column as { widgetId?: unknown }).widgetId !== "string") || ("alignment" in column && !["left", "center", "right"].includes((column as { alignment?: unknown }).alignment as string)))) {
    return NextResponse.json({ error: "Invalid site layout." }, { status: 400 });
  }
  try {
    await saveSiteLayout(header as HeaderLayout, normalizeFooterLayout(footer));
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}
