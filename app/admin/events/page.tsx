import Link from "next/link";
import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

export default async function EventsPage() {
  const user = await requirePermission("MANAGE_EVENTS");
  await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
  return <main>
    <Container className="py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p>
      <h1 className="mt-2 font-serif text-4xl">Events and scheduling</h1>
      <p className="mt-3 max-w-3xl text-ink/60">Plan church events and coordinate the volunteer teams needed to make them happen.</p>
      <Link href="/admin/events/volunteer-scheduling" className="focus-ring mt-8 block max-w-md rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition hover:border-coral">
        <h2 className="font-serif text-2xl">Volunteer Scheduling</h2>
        <p className="mt-2 text-sm text-ink/60">Create event dates, select volunteer teams, assign members, and record participation.</p>
        <span className="mt-4 inline-block text-sm font-semibold text-coral">Open Volunteer Scheduling →</span>
      </Link>
    </Container>
  </main>;
}
