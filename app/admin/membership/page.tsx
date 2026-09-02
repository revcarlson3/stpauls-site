import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

export default async function MembershipPage() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><h1 className="mt-2 font-serif text-4xl">Membership</h1><p className="mt-4 max-w-2xl text-ink/60">The membership module is enabled and ready for its first management workflows.</p></Container></main>;
}
