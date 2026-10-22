import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePublicTenant } from "@/lib/platform-domain";
import { getPublicAnnouncement, listPublicAnnouncementData } from "@/lib/announcement-publications";
import { AnnouncementArchive, AnnouncementPublicationContent } from "@/components/announcement-publications";

export default async function PublicAnnouncementPage({ params }: { params: { id: string } }) {
  const tenant = await resolvePublicTenant(headers().get("host"));
  if (!tenant) notFound();
  const [publication, data] = await Promise.all([getPublicAnnouncement(tenant.id, params.id), listPublicAnnouncementData(tenant.id)]);
  if (!publication) notFound();
  return <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 sm:py-16"><AnnouncementPublicationContent publication={publication} /><AnnouncementArchive items={data.archive} /></div>;
}
