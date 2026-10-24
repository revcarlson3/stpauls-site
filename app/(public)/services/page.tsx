import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { db } from "@/lib/db";
import { resolvePublicTenant } from "@/lib/platform-domain";

export const dynamic = "force-dynamic";

function canShowWords(hymn: { lyricsRights: string; lyricsText: string | null }) {
  return hymn.lyricsRights === "PUBLIC_DOMAIN" && Boolean(hymn.lyricsText);
}

function canShowMusic(hymn: { musicRights: string; arrangementRights: string; musicImageUrl: string | null; musicUrl: string | null }) {
  return hymn.musicRights === "PUBLIC_DOMAIN" && hymn.arrangementRights === "PUBLIC_DOMAIN" && Boolean(hymn.musicImageUrl || hymn.musicUrl);
}

export default async function PublicServicesPage() {
  const tenant = await resolvePublicTenant(headers().get("host"));
  if (!tenant || !tenant.publicSiteEnabled) redirect("/admin/login");
  const services = await db.worshipService.findMany({
    where: { churchId: tenant.id, status: "PUBLISHED", OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] },
    orderBy: { startsAt: "desc" },
    take: 50,
    include: {
      clergy: { orderBy: { sortOrder: "asc" }, include: { clergy: { select: { title: true, firstName: true, lastName: true } } } },
      lessons: { orderBy: { sortOrder: "asc" }, select: { reference: true } },
      hymns: { orderBy: { sortOrder: "asc" }, include: { hymn: true } },
    },
  });
  return <main className="site-section bg-sand"><Container className="max-w-4xl">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Worship</p>
    <h1 className="mt-2 font-serif text-5xl">Services</h1>
    <div className="mt-10 grid gap-8">
      {services.length === 0 ? <p className="rounded-xl border border-dashed border-ink/20 bg-white p-6 text-ink/60">No published services are currently available.</p> : services.map((service) => <article key={service.id} className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <p className="text-sm text-ink/55">{service.startsAt.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</p>
        <h2 className="mt-2 font-serif text-3xl">{service.title}</h2>
        {service.liturgy && <p className="mt-2 text-ink/65">{service.liturgy}</p>}
        {service.description && <p className="mt-4 whitespace-pre-wrap leading-7 text-ink/75">{service.description}</p>}
        {service.clergy.length > 0 && <p className="mt-4 text-sm text-ink/60">Led by {service.clergy.map((entry) => `${entry.clergy.title} ${entry.clergy.firstName ?? ""} ${entry.clergy.lastName ?? ""}`.trim()).join(", ")}</p>}
        {service.lessons.length > 0 && <p className="mt-2 text-sm text-ink/60">Lessons: {service.lessons.map((lesson) => lesson.reference).filter(Boolean).join("; ")}</p>}
        {service.hymns.length > 0 && <div className="mt-6 grid gap-5 border-t border-ink/10 pt-5"><h3 className="font-serif text-2xl">Hymns</h3>{service.hymns.map((entry) => {
          const hymn = entry.hymn;
          const words = hymn && canShowWords(hymn);
          const music = hymn && canShowMusic(hymn);
          return <section key={entry.id} className="rounded-xl border border-ink/10 p-4">
            <h4 className="font-semibold">{entry.number ? `${entry.number} — ` : ""}{entry.title}</h4>
            {hymn?.tuneName && <p className="mt-1 text-sm text-ink/55">Tune: {hymn.tuneName}</p>}
            {words && <p className="mt-4 whitespace-pre-wrap font-serif leading-7">{hymn.lyricsText}</p>}
            {music && <div className="mt-4 grid gap-3">{hymn.musicImageUrl && <img src={hymn.musicImageUrl} alt={`Public-domain music for ${entry.title}`} className="max-w-full rounded border border-ink/10" />}{hymn.musicUrl && <a href={hymn.musicUrl} target="_blank" rel="noreferrer" className="font-semibold text-coral hover:underline">View public-domain music</a>}</div>}
            {!words && !music && <p className="mt-3 text-sm text-ink/55">Words and music are not available for public display.</p>}
          </section>;
        })}</div>}
      </article>)}
    </div>
  </Container></main>;
}
