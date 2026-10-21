import { Container } from "@/components/ui";
import { listPublicWidgets, resolvePublicMenu, resolvePublicWidget } from "@/lib/content";
import { PublicWidget } from "@/components/public-widget";
import type { getSiteIdentity as GetSiteIdentity } from "@/lib/site-identity";
import type { getSiteLayout as GetSiteLayout } from "@/lib/site-layout";

function safeRichText(value: unknown) {
  return typeof value === "string" ? value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "") : "";
}

export async function SiteFooter({ layout, identity }: { layout: Awaited<ReturnType<typeof GetSiteLayout>>; identity: Awaited<ReturnType<typeof GetSiteIdentity>> }) {
  const [columns, footerWidgets] = await Promise.all([
    Promise.all(layout.footer.columns.map(async (column) => ({ column, widget: await resolvePublicWidget(column.widgetId) }))),
    listPublicWidgets("footer")
  ]);
  const assignedWidgetIds = new Set(columns.map(({ widget }) => widget?.id).filter((id): id is string => Boolean(id)));
  const columnGridClass = layout.footer.columns.length === 2 ? "lg:grid-cols-2" : layout.footer.columns.length === 3 ? "lg:grid-cols-3" : layout.footer.columns.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-5";
  return <footer className={`site-footer border-t border-white/10 py-10 ${layout.footer.style === "centered" ? "text-center" : ""}`} style={{ backgroundColor: layout.footer.background, color: layout.footer.textColor }}>
    <Container className="grid gap-8">
      {layout.footer.style === "columns" && <div className={`grid grid-cols-1 gap-8 sm:grid-cols-2 ${columnGridClass} ${layout.footer.columnDividers ? "footer-column-dividers" : ""}`}>{columns.map(({ column, widget }, index) => { const config = widget?.config && typeof widget.config === "object" && !Array.isArray(widget.config) ? widget.config as Record<string, unknown> : {}; const alignmentClass = column.alignment === "center" ? "text-center" : column.alignment === "right" ? "text-right" : "text-left"; return <section key={index} className={alignmentClass}>{column.heading && <h2 className="font-serif text-xl">{column.heading}</h2>}{widget?.type === "text" && <div className="rich-text-content mt-3 text-sm opacity-80" dangerouslySetInnerHTML={{ __html: safeRichText(config.content) }} />}{widget?.type === "menu" && typeof config.menuId === "string" ? <FooterMenu menuId={config.menuId} alignment={column.alignment} /> : null}</section>; })}</div>}
      {layout.footer.style === "columns" && footerWidgets.filter((widget) => !assignedWidgetIds.has(widget.id)).length > 0 && <div className="grid gap-8 border-t border-current/15 pt-8 sm:grid-cols-2 lg:grid-cols-3">{footerWidgets.filter((widget) => !assignedWidgetIds.has(widget.id)).map((widget) => <PublicWidget key={widget.id} widget={widget} />)}</div>}
      {layout.footer.style !== "columns" && <div className="text-sm opacity-80">{identity.name}{identity.showTagline && identity.tagline ? ` · ${identity.tagline}` : ""}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-5 text-sm opacity-75"><span>{layout.footer.copyright || `© ${new Date().getFullYear()} ${identity.name}`}</span>{layout.footer.credit && <span>{layout.footer.credit}</span>}</div>
    </Container>
  </footer>;
}

async function FooterMenu({ menuId, alignment }: { menuId: string; alignment: "left" | "center" | "right" }) {
  const menu = await resolvePublicMenu(menuId, null);
  return menu ? <ul className={`mt-3 grid gap-2 text-sm opacity-80 ${alignment === "center" ? "justify-items-center" : alignment === "right" ? "justify-items-end" : "justify-items-start"}`}>{menu.items.filter((item) => !item.parentId).map((item) => <li key={item.id}><a href={item.href} className="hover:opacity-70">{item.label}</a></li>)}</ul> : null;
}
