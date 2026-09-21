import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { PledgesPage } from "./pledges-page";

export default async function GivingPledgesPage() {
  const user = await requirePermission("MANAGE_GIVING");
  await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
  await requireCurrentChurch();
  return <PledgesPage />;
}
