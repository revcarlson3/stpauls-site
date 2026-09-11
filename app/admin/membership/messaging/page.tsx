import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { MembershipMessaging } from "./membership-messaging";

export default async function MembershipMessagingPage({ searchParams }: { searchParams: { memberIds?: string | string[]; target?: string; audienceId?: string } }) {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  const initialMemberIds = Array.isArray(searchParams.memberIds) ? searchParams.memberIds : searchParams.memberIds ? searchParams.memberIds.split(",") : [];
  return (
    <main>
      <Container className="py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p>
            <h1 className="mt-2 font-serif text-4xl">Message members</h1>
            <p className="mt-4 max-w-2xl text-ink/60">Compose a thoughtful email or SMS, then choose the audience. Contact preferences are checked again when the message is saved.</p>
          </div>
          <a className="focus-ring rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral" href="/admin/membership">Back to directory</a>
        </div>
        <MembershipMessaging initialMemberIds={initialMemberIds} initialTarget={searchParams.target} initialAudienceId={searchParams.audienceId} />
      </Container>
    </main>
  );
}
