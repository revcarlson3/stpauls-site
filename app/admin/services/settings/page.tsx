import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { HymnalSettings } from "./hymnal-settings";

export default async function ServicesSettingsPage() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return <main><div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Services and sermons</p><h1 className="mt-2 font-serif text-4xl">Settings</h1><p className="mt-3 max-w-3xl text-ink/60">Configure services and sermons module defaults, publishing, and integrations.</p><HymnalSettings /></div></main>;
}
