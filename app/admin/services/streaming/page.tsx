import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { StreamingSettings } from "./streaming-settings";

export default async function StreamingPage() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return <main><div className="mx-auto max-w-6xl px-5 py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Services and sermons</p><h1 className="mt-2 font-serif text-4xl">Streaming</h1><p className="mt-3 max-w-3xl text-ink/60">Configure livestream destinations and prepare online worship broadcasts without streaming video through this website.</p><StreamingSettings /></div></main>;
}
