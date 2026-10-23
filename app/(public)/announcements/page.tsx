import { headers } from "next/headers";
import { resolvePublicTenant } from "@/lib/platform-domain";
import { ensurePublicAnnouncementsPage } from "@/lib/content";
import { PublishedPageShell } from "@/components/page-renderer";

export default async function PublicAnnouncementsPage() {
  const tenant = await resolvePublicTenant(headers().get("host"));
  if (!tenant) return <div className="mx-auto max-w-4xl px-6 py-16"><h1 className="font-serif text-4xl">Announcements</h1><p className="mt-3 text-ink/60">No site was found.</p></div>;
  const page = await ensurePublicAnnouncementsPage(tenant.id);
  return <PublishedPageShell title={page.title} blocks={page.blocks} pageId={page.id} pageSlug={page.slug} pageThemeFamily={page.pageThemeFamily} pageThemeWidth={page.pageThemeWidth} editHref={`/admin/editor/${page.id}`} showHeader={page.showHeader} showFooter={page.showFooter} fullScreen={page.fullScreen} />;
}
