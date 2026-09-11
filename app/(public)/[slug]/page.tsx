import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PublishedPageShell } from "@/components/page-renderer";
import { PagePasswordGate } from "@/components/page-password-gate";
import { hasPageAccess } from "@/lib/page-access";
import { isPublicSiteEnabled } from "@/lib/modules";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await db.page.findFirst({
    where: { slug: params.slug, OR: [{ status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, { status: "DRAFT", publishAt: { lte: new Date() } }] },
    select: { title: true, seoTitle: true, seoDescription: true, seoKeywords: true, passwordHash: true }
  });
  if (!page) return {};
  if (page.passwordHash) return { title: "Protected page", robots: { index: false, follow: false } };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    keywords: page.seoKeywords ? page.seoKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean) : undefined
  };
}

export default async function PublishedPage({ params }: { params: { slug: string } }) {
  if (!(await isPublicSiteEnabled())) redirect("/admin/login");
  const page = await db.page.findFirst({
    where: { slug: params.slug, OR: [{ status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, { status: "DRAFT", publishAt: { lte: new Date() } }] },
    select: { id: true, slug: true, title: true, blocks: true, pageThemeFamily: true, pageThemeWidth: true, showHeader: true, showFooter: true, fullScreen: true, passwordHash: true }
  });

  if (!page) notFound();
  if (!hasPageAccess(page.id, page.passwordHash)) return <PagePasswordGate pageId={page.id} title={page.title} />;
  return <PublishedPageShell title={page.title} blocks={page.blocks} pageId={page.id} pageSlug={page.slug} pageThemeFamily={page.pageThemeFamily} pageThemeWidth={page.pageThemeWidth} editHref={`/admin/editor/${page.id}`} showHeader={page.showHeader} showFooter={page.showFooter} fullScreen={page.fullScreen} />;
}
