import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { defaultFooterLayout, defaultHeaderLayout, type FooterColumn, type FooterLayout, type HeaderLayout } from "@/lib/site-layout-types";
export { defaultFooterLayout, defaultHeaderLayout };
export type { FooterLayout, HeaderLayout };

export function normalizeHeaderLayout(value: unknown): HeaderLayout {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const menuIds = (value: unknown): string[] => Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))) : [];
  const preHeaderInput = input.preHeader && typeof input.preHeader === "object" && !Array.isArray(input.preHeader)
    ? input.preHeader as Record<string, unknown>
    : {};
  return {
    height: input.height === "compact" || input.height === "tall" ? input.height : defaultHeaderLayout.height,
    background: typeof input.background === "string" ? input.background : defaultHeaderLayout.background,
    textColor: typeof input.textColor === "string" ? input.textColor : defaultHeaderLayout.textColor,
    sticky: input.sticky === true,
    stylistic: input.stylistic === true,
    menuId: typeof input.menuId === "string" && input.menuId ? input.menuId : null,
    accountMenuIds: menuIds(input.accountMenuIds),
    membershipMenuIds: menuIds(input.membershipMenuIds),
    logoutMenuIds: menuIds(input.logoutMenuIds),
    notificationMenuIds: menuIds(input.notificationMenuIds),
    preHeader: {
      enabled: preHeaderInput.enabled === true,
      background: typeof preHeaderInput.background === "string" ? preHeaderInput.background : defaultHeaderLayout.preHeader.background,
      height: preHeaderInput.height === "standard" || preHeaderInput.height === "tall" ? preHeaderInput.height : defaultHeaderLayout.preHeader.height,
      fontSize: preHeaderInput.fontSize === "small" || preHeaderInput.fontSize === "large" ? preHeaderInput.fontSize : defaultHeaderLayout.preHeader.fontSize,
      alignment: preHeaderInput.alignment === "left" || preHeaderInput.alignment === "center" ? preHeaderInput.alignment : defaultHeaderLayout.preHeader.alignment,
      html: typeof preHeaderInput.html === "string"
        ? preHeaderInput.html
        : typeof preHeaderInput.text === "string" ? preHeaderInput.text : "",
      menuId: typeof preHeaderInput.menuId === "string" && preHeaderInput.menuId ? preHeaderInput.menuId : null
    }
  };
}

function footerFrom(value: unknown): FooterLayout {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const columns = Array.isArray(input.columns) ? input.columns.filter((column): column is Record<string, unknown> => Boolean(column) && typeof column === "object" && !Array.isArray(column)).slice(0, 5).map((column) => ({
    heading: typeof column.heading === "string" ? column.heading : "",
    widgetId: typeof column.widgetId === "string" && column.widgetId ? column.widgetId : null,
    alignment: (column.alignment === "center" || column.alignment === "right" ? column.alignment : "left") as FooterColumn["alignment"]
  })) : defaultFooterLayout.columns;
  return {
    background: typeof input.background === "string" ? input.background : defaultFooterLayout.background,
    textColor: typeof input.textColor === "string" ? input.textColor : defaultFooterLayout.textColor,
    style: input.style === "simple" || input.style === "centered" ? input.style : defaultFooterLayout.style,
    copyright: typeof input.copyright === "string" ? input.copyright : defaultFooterLayout.copyright,
    credit: typeof input.credit === "string" ? input.credit : defaultFooterLayout.credit,
    columns: columns.length ? columns : defaultFooterLayout.columns,
    columnDividers: input.columnDividers === true
  };
}

export function normalizeFooterLayout(value: unknown): FooterLayout {
  return footerFrom(value);
}

export async function getSiteLayout() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { headerConfig: true, footerConfig: true } });
  return { header: normalizeHeaderLayout(settings?.headerConfig), footer: footerFrom(settings?.footerConfig) };
}

export async function saveSiteLayout(header: HeaderLayout, footer: FooterLayout) {
  await requirePermission("MANAGE_SETTINGS");
  return db.securitySettings.upsert({
    where: { id: 1 },
    update: { headerConfig: header, footerConfig: footer },
    create: { id: 1, headerConfig: header, footerConfig: footer }
  });
}
