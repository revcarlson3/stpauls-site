import { Container } from "@/components/ui";
import { EventsCalendar } from "@/app/admin/events/events-calendar";

export default async function SchedulingEventsPage() {
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p><h1 className="mt-2 font-serif text-4xl">Events and scheduling</h1><p className="mt-3 max-w-3xl text-ink/60">View church events by month, week, or agenda, and manage event details, attendance, and volunteer scheduling.</p><EventsCalendar /></Container></main>;
}
