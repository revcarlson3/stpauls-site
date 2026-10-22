import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PublishedPageShell } from "@/components/page-renderer";
import { PagePasswordGate } from "@/components/page-password-gate";
import { hasPageAccess } from "@/lib/page-access";
import { headers } from "next/headers";
import { resolvePublicTenant } from "@/lib/platform-domain";

export const dynamic = "force-dynamic";

function PageUnavailable() {
  return <main className="fixed inset-0 z-[100] grid min-h-screen place-items-center overflow-auto bg-sand px-6 py-16 text-center text-ink">
    <div className="w-full max-w-xl rounded-3xl border border-ink/10 bg-white/90 p-8 shadow-xl sm:p-12">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-coral">Page not available</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">We&apos;re still preparing this page.</h1>
      <p className="mx-auto mt-5 max-w-md text-base leading-7 text-ink/65">The page you requested has not been published yet, or is temporarily unavailable. Please check back soon.</p>
      <a href="/" className="focus-ring mt-8 inline-flex rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white transition hover:bg-coral/90">Return to home</a>
    </div>
  </main>;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await resolvePublicTenant(headers().get("host"));
  const page = await db.page.findFirst({
    where: { churchId: tenant?.id ?? "", slug: params.slug },
    select: { title: true, seoTitle: true, seoDescription: true, seoKeywords: true, passwordHash: true, status: true, publishAt: true }
  });
  if (!page) return {};
  if (page.status !== "PUBLISHED" || (page.publishAt && page.publishAt > new Date())) return { robots: { index: false, follow: false } };
  if (page.passwordHash) return { title: "Protected page", robots: { index: false, follow: false } };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    keywords: page.seoKeywords ? page.seoKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean) : undefined
  };
}

export default async function PublishedPage({ params }: { params: { slug: string } }) {
  const tenant = await resolvePublicTenant(headers().get("host"));
  if (!tenant || !tenant.publicSiteEnabled) redirect("/admin/login");
  const page = await db.page.findFirst({
    where: { churchId: tenant.id, slug: params.slug },
    select: { id: true, slug: true, title: true, blocks: true, pageThemeFamily: true, pageThemeWidth: true, showHeader: true, showFooter: true, fullScreen: true, passwordHash: true, status: true, publishAt: true }
  });

  if (!page || page.status !== "PUBLISHED" || (page.publishAt && page.publishAt > new Date())) return <PageUnavailable />;
  if (!hasPageAccess(page.id, page.passwordHash)) return <PagePasswordGate pageId={page.id} title={page.title} />;
  return <PublishedPageShell title={page.title} blocks={page.blocks} pageId={page.id} pageSlug={page.slug} pageThemeFamily={page.pageThemeFamily} pageThemeWidth={page.pageThemeWidth} editHref={`/admin/editor/${page.id}`} showHeader={page.showHeader} showFooter={page.showFooter} fullScreen={page.fullScreen} />;
}
