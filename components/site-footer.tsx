import { Container } from "@/components/ui";
import { listPublicWidgets, resolvePublicMenu, resolvePublicWidget } from "@/lib/content";
import { PublicWidget } from "@/components/public-widget";
import { getSiteIdentity } from "@/lib/site-identity";
import { getSiteLayout } from "@/lib/site-layout";

function safeRichText(value: unknown) {
  return typeof value === "string" ? value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "") : "";
}

export async function SiteFooter() {
  const [layout, identity] = await Promise.all([getSiteLayout(), getSiteIdentity()]);
  const [columns, footerWidgets] = await Promise.all([
    Promise.all(layout.footer.columns.map(async (column) => ({ column, widget: await resolvePublicWidget(column.widgetId) }))),
    listPublicWidgets("footer")
  ]);
  const assignedWidgetIds = new Set(columns.map(({ widget }) => widget?.id).filter((id): id is string => Boolean(id)));
  return <footer className={`site-footer border-t border-white/10 py-10 ${layout.footer.style === "centered" ? "text-center" : ""}`} style={{ backgroundColor: layout.footer.background, color: layout.footer.textColor }}>
    <Container className="grid gap-8">
      {layout.footer.style === "columns" && <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{columns.map(({ column, widget }, index) => { const config = widget?.config && typeof widget.config === "object" && !Array.isArray(widget.config) ? widget.config as Record<string, unknown> : {}; return <section key={index}>{column.heading && <h2 className="font-serif text-xl">{column.heading}</h2>}{widget?.type === "text" && <div className="rich-text-content mt-3 text-sm opacity-80" dangerouslySetInnerHTML={{ __html: safeRichText(config.content) }} />}{widget?.type === "menu" && typeof config.menuId === "string" ? <FooterMenu menuId={config.menuId} /> : null}</section>; })}</div>}
      {footerWidgets.filter((widget) => !assignedWidgetIds.has(widget.id)).length > 0 && <div className="grid gap-8 border-t border-current/15 pt-8 sm:grid-cols-2 lg:grid-cols-3">{footerWidgets.filter((widget) => !assignedWidgetIds.has(widget.id)).map((widget) => <PublicWidget key={widget.id} widget={widget} />)}</div>}
      {layout.footer.style !== "columns" && <div className="text-sm opacity-80">{identity.name}{identity.showTagline && identity.tagline ? ` · ${identity.tagline}` : ""}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-5 text-sm opacity-75"><span>{layout.footer.copyright || `© ${new Date().getFullYear()} ${identity.name}`}</span>{layout.footer.credit && <span>{layout.footer.credit}</span>}</div>
    </Container>
  </footer>;
}

async function FooterMenu({ menuId }: { menuId: string }) {
  const menu = await resolvePublicMenu(menuId, null);
  return menu ? <ul className="mt-3 grid gap-2 text-sm opacity-80">{menu.items.filter((item) => !item.parentId).map((item) => <li key={item.id}><a href={item.href} className="hover:opacity-70">{item.label}</a></li>)}</ul> : null;
}
