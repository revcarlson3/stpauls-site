import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { defaultFooterLayout, defaultHeaderLayout, type FooterLayout, type HeaderLayout } from "@/lib/site-layout-types";
export { defaultFooterLayout, defaultHeaderLayout };
export type { FooterLayout, HeaderLayout };

function headerFrom(value: unknown): HeaderLayout {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    height: input.height === "compact" || input.height === "tall" ? input.height : defaultHeaderLayout.height,
    background: typeof input.background === "string" ? input.background : defaultHeaderLayout.background,
    textColor: typeof input.textColor === "string" ? input.textColor : defaultHeaderLayout.textColor,
    sticky: input.sticky === true,
    menuId: typeof input.menuId === "string" && input.menuId ? input.menuId : null
  };
}

function footerFrom(value: unknown): FooterLayout {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const columns = Array.isArray(input.columns) ? input.columns.filter((column): column is Record<string, unknown> => Boolean(column) && typeof column === "object" && !Array.isArray(column)).slice(0, 4).map((column) => ({
    heading: typeof column.heading === "string" ? column.heading : "",
    widgetId: typeof column.widgetId === "string" && column.widgetId ? column.widgetId : null
  })) : defaultFooterLayout.columns;
  return {
    background: typeof input.background === "string" ? input.background : defaultFooterLayout.background,
    textColor: typeof input.textColor === "string" ? input.textColor : defaultFooterLayout.textColor,
    style: input.style === "simple" || input.style === "centered" ? input.style : defaultFooterLayout.style,
    copyright: typeof input.copyright === "string" ? input.copyright : defaultFooterLayout.copyright,
    credit: typeof input.credit === "string" ? input.credit : defaultFooterLayout.credit,
    columns: columns.length ? columns : defaultFooterLayout.columns
  };
}

export async function getSiteLayout() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { headerConfig: true, footerConfig: true } });
  return { header: headerFrom(settings?.headerConfig), footer: footerFrom(settings?.footerConfig) };
}

export async function saveSiteLayout(header: HeaderLayout, footer: FooterLayout) {
  await requirePermission("MANAGE_SETTINGS");
  return db.securitySettings.upsert({
    where: { id: 1 },
    update: { headerConfig: header, footerConfig: footer },
    create: { id: 1, headerConfig: header, footerConfig: footer }
  });
}
