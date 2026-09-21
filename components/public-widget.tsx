import { resolvePublicMenu } from "@/lib/content";
import { MenuLinks } from "@/components/menu-links";

type PublicWidgetData = {
  id: string;
  name: string;
  type: string;
  config: unknown;
};

function safeRichText(value: unknown) {
  return typeof value === "string"
    ? value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, "")
    : "";
}

export async function PublicWidget({ widget, className = "" }: { widget: PublicWidgetData; className?: string }) {
  const config = widget.config && typeof widget.config === "object" && !Array.isArray(widget.config)
    ? widget.config as Record<string, unknown>
    : {};
  if (widget.type === "text" && typeof config.content === "string") {
    return <section className={className} aria-label={widget.name}><h2 className="sr-only">{widget.name}</h2><div className="rich-text-content text-sm opacity-80" dangerouslySetInnerHTML={{ __html: safeRichText(config.content) }} /></section>;
  }
  if (widget.type === "menu" && typeof config.menuId === "string") {
    const menu = await resolvePublicMenu(config.menuId, null);
    if (!menu) return null;
    return <nav className={className} aria-label={widget.name}><h2 className="sr-only">{widget.name}</h2><MenuLinks items={menu.items} /></nav>;
  }
  return null;
}
