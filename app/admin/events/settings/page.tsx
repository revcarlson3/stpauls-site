import { Container } from "@/components/ui";
import { EventSettingsManager } from "./settings-manager";

export default function EventSettingsPage() {
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p><h1 className="mt-2 font-serif text-4xl">Event settings</h1><p className="mt-3 max-w-2xl text-ink/60">Manage the choices available when creating events and set the calendar timezone.</p><EventSettingsManager /></Container></main>;
}
