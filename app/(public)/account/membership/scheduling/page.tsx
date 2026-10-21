import Link from "next/link";
import { Card, Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function MemberSchedulingPage() {
  const user = await getCurrentUser();
  const link = user ? await db.membershipUserMemberLink.findUnique({
    where: { userId: user.id },
    include: {
      individual: {
        select: {
          id: true,
          churchId: true,
          volunteerGroups: { orderBy: { group: { position: "asc" } }, select: { role: true, isLeader: true, group: { select: { id: true, name: true, description: true } } } }
        }
      }
    }
  }) : null;

  if (!link) return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Card>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member center</p>
    <h1 className="mt-2 font-serif text-4xl">Scheduling</h1>
    <p className="mt-4 leading-7 text-ink/60">Your account is not linked to a membership record yet, so volunteer scheduling information is unavailable.</p>
    <Link href="/account/membership" className="focus-ring mt-6 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Back to member center</Link>
  </Card></Container></main>;

  const now = new Date();
  const events = await db.membershipEvent.findMany({
    where: { churchId: link.individual.churchId, startsAt: { gte: now }, status: { not: "CANCELLED" }, rotationAssignments: { some: { individualId: link.individual.id } } },
    orderBy: { startsAt: "asc" },
    take: 20,
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      location: true,
      timeZone: true,
      rotationAssignments: { where: { individualId: link.individual.id }, select: { group: { select: { name: true } } } }
    }
  });
  const dateFormatter = (timeZone?: string | null) => new Intl.DateTimeFormat("en-US", { timeZone: timeZone || undefined, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const groups = link.individual.volunteerGroups;

  return <main className="py-12 sm:py-16"><Container className="max-w-5xl">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member center</p>
    <h1 className="mt-2 font-serif text-4xl">Scheduling</h1>
    <p className="mt-4 max-w-2xl leading-7 text-ink/60">View your volunteer groups and upcoming events where you have been scheduled.</p>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section aria-labelledby="volunteer-groups-heading">
        <h2 id="volunteer-groups-heading" className="font-serif text-2xl">Volunteer groups</h2>
        {groups.length ? <div className="mt-4 grid gap-3">{groups.map(({ group, role, isLeader }) => <Card key={group.id} className="p-5">
          <h3 className="font-semibold">{group.name}</h3>
          {group.description && <p className="mt-2 text-sm leading-6 text-ink/60">{group.description}</p>}
          {(role || isLeader) && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/50">{[role, isLeader ? "Leader" : ""].filter(Boolean).join(" · ")}</p>}
        </Card>)}</div> : <Card className="mt-4"><p className="text-sm text-ink/60">You are not currently assigned to any volunteer groups.</p></Card>}
      </section>
      <section aria-labelledby="upcoming-schedule-heading">
        <h2 id="upcoming-schedule-heading" className="font-serif text-2xl">Upcoming scheduled events</h2>
        {events.length ? <div className="mt-4 grid gap-3">{events.map((event) => <Card key={event.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{event.title}</h3><p className="mt-1 text-sm text-ink/60">{event.allDay ? new Intl.DateTimeFormat("en-US", { timeZone: event.timeZone || undefined, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(event.startsAt) : dateFormatter(event.timeZone).format(event.startsAt)}</p></div>{event.location && <span className="text-sm text-ink/55">{event.location}</span>}</div>
          <p className="mt-3 text-sm text-ink/60">Scheduled for: {Array.from(new Set(event.rotationAssignments.map((assignment) => assignment.group.name))).join(", ")}</p>
        </Card>)}</div> : <Card className="mt-4"><p className="text-sm text-ink/60">You do not have any upcoming scheduled events.</p></Card>}
      </section>
    </div>
    <Link href="/account/membership" className="focus-ring mt-8 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Back to member center</Link>
  </Container></main>;
}
