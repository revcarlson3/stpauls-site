import type { ReactNode } from "react";
import { Card, Container } from "@/components/ui";
import { blockDefinitions } from "@/lib/blocks";
import { SiteHeader } from "@/components/site-header";
import { resolvePublicMenu } from "@/lib/content";
import { MenuLinks } from "@/components/menu-links";

type RenderBlock = {
  id: string;
  type: string;
  title?: string;
  props?: Record<string, unknown>;
};

function isRenderBlock(value: unknown): value is RenderBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  return typeof block.id === "string" && typeof block.type === "string";
}

function BlockSurface({ as, labelledBy, children }: { as: "section" | "aside" | "footer"; labelledBy: string; children: ReactNode }) {
  const className = "rounded-2xl border border-ink/10 bg-white p-6 shadow-sm";
  if (as === "aside") return <aside aria-labelledby={labelledBy} className={className}>{children}</aside>;
  if (as === "footer") return <footer aria-labelledby={labelledBy} className={className}>{children}</footer>;
  return <section aria-labelledby={labelledBy} className={className}>{children}</section>;
}

export async function PageRenderer({ blocks }: { blocks: unknown }) {
  const validBlocks = Array.isArray(blocks) ? blocks.filter(isRenderBlock) : [];
  const renderedBlocks = await Promise.all(validBlocks.map(async (block) => {
    const definition = blockDefinitions[block.type as keyof typeof blockDefinitions];
    const label = definition?.label ?? block.type;
    const title = block.title ?? definition?.label ?? "Content block";
    const menuId = typeof block.props?.menuId === "string" ? block.props.menuId : null;
    const menuLocationId = typeof block.props?.menuLocationId === "string" ? block.props.menuLocationId : null;
    const menu = ["pre-header", "header", "hero", "sidebar", "footer"].includes(block.type)
      ? await resolvePublicMenu(menuId, menuLocationId)
      : null;

    if (block.type === "header") return <SiteHeader key={block.id} menuId={menuId} menuLocationId={menuLocationId} />;

    const surfaceType = block.type === "sidebar" ? "aside" : block.type === "footer" ? "footer" : "section";
    const headingId = `block-heading-${block.id}`;
    return (
      <BlockSurface key={block.id} as={surfaceType} labelledBy={headingId}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">{label}</p>
        <h2 id={headingId} className="mt-2 font-serif text-3xl">{title}</h2>
        <p className="mt-3 text-ink/60">This {label.toLowerCase()} block is ready for its content fields.</p>
        {menu && <nav aria-label={`${label} navigation`} className={`mt-5 border-t border-ink/10 pt-4 text-sm font-semibold ${block.type === "hero" ? "rounded-lg bg-sand/60 p-4" : ""}`}><MenuLinks items={menu.items} /></nav>}
      </BlockSurface>
    );
  }));

  return (
    <div className="grid gap-5">
      {renderedBlocks}
    </div>
  );
}

export async function PublishedPageShell({ title, blocks }: { title: string; blocks: unknown }) {
  return (
    <main className="py-12 sm:py-20">
      <Container>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Published page</p>
        <h1 className="mt-3 font-serif text-5xl">{title}</h1>
        <Card className="mt-10 bg-sand/60">
          <PageRenderer blocks={blocks} />
        </Card>
      </Container>
    </main>
  );
}
