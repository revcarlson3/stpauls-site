import Link from "next/link";

type Publication = { id: string; title: string; bodyHtml?: string; publishedAt: string | null };

export function AnnouncementPublicationContent({ publication }: { publication: Publication }) {
  return (
    <article className="announcement-publication mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">{publication.publishedAt ? new Date(publication.publishedAt).toLocaleDateString() : "Announcement"}</p>
          <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">{publication.title}</h1>
        </div>
        <p className="max-w-xs text-sm leading-6 text-ink/55">Community news, worship, events, and updates from your church.</p>
      </header>
      {publication.bodyHtml && <div className="announcement-publication-frame"><div className="announcement-rich-content" dangerouslySetInnerHTML={{ __html: publication.bodyHtml }} /></div>}
    </article>
  );
}

export function AnnouncementArchive({ items }: { items: Publication[] }) {
  return (
    <nav aria-label="Announcement archive" className="mx-auto mt-12 max-w-5xl border-t border-ink/10 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">Explore</p><h2 className="mt-1 font-serif text-3xl">Announcement archive</h2></div>
        <p className="text-sm text-ink/55">Browse previous publications.</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((item) => <Link key={item.id} href={`/announcements/${item.id}`} className="focus-ring rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-coral hover:shadow-md"><span className="block font-serif text-xl text-ink">{item.title}</span>{item.publishedAt && <span className="mt-2 block text-sm text-ink/55">{new Date(item.publishedAt).toLocaleDateString()}</span>}<span className="mt-4 inline-block text-sm font-semibold text-coral">Read publication →</span></Link>)}
      </div>
    </nav>
  );
}
