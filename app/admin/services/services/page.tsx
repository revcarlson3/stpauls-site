import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { Container } from "@/components/ui";
import { ServicesManager } from "./services-manager";

export default async function ServicesSchedulePage() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Services and sermons</p><h1 className="mt-2 font-serif text-4xl">Services</h1><p className="mt-3 max-w-3xl text-ink/60">Manage worship services, schedules, worship details, and optional calendar listings.</p><ServicesManager /></Container></main>;
}
