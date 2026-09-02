import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { MembershipDirectory } from "./membership-directory";

export default async function MembershipPage() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="mt-2 font-serif text-4xl">Membership</h1><p className="mt-4 max-w-2xl text-ink/60">Browse members by name or member type. Select a member to view their individual and family details.</p></div><a className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" href="/admin/membership/add">Add family</a></div><MembershipDirectory /></Container></main>;
}
