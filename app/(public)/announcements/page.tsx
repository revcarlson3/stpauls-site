import { headers } from "next/headers";
import { resolvePublicTenant } from "@/lib/platform-domain";
import { listPublicAnnouncementData } from "@/lib/announcement-publications";
import { AnnouncementArchive, AnnouncementPublicationContent } from "@/components/announcement-publications";

export default async function PublicAnnouncementsPage() {
  const tenant = await resolvePublicTenant(headers().get("host"));
  if (!tenant) return <div className="mx-auto max-w-4xl px-6 py-16"><h1 className="font-serif text-4xl">Announcements</h1><p className="mt-3 text-ink/60">No site was found.</p></div>;
  const data = await listPublicAnnouncementData(tenant.id);
  return <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 sm:py-16"><h1 className="sr-only">Announcements</h1>{data.latest ? <AnnouncementPublicationContent publication={data.latest} /> : <p className="text-ink/60">There are no published announcements yet.</p>}<AnnouncementArchive items={data.archive} /></div>;
}
