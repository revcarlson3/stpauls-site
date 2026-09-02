import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

export default async function MembershipPage() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><h1 className="mt-2 font-serif text-4xl">Membership</h1><p className="mt-4 max-w-2xl text-ink/60">The membership foundation is ready for family and individual directory workflows.</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-ink/10 bg-white p-5"><h2 className="font-serif text-xl">Families</h2><p className="mt-2 text-sm text-ink/60">Household records and lifecycle status.</p></div><div className="rounded-2xl border border-ink/10 bg-white p-5"><h2 className="font-serif text-xl">Individuals</h2><p className="mt-2 text-sm text-ink/60">Member records with roles and member numbers.</p></div><div className="rounded-2xl border border-ink/10 bg-white p-5"><h2 className="font-serif text-xl">Configuration</h2><p className="mt-2 text-sm text-ink/60">Roles, member types, and custom fields.</p></div></div></Container></main>;
}
