import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { OnlineGivingSettings } from "./online-giving-settings";

export default async function OnlineGivingAdminPage() {
  const user = await requirePermission("MANAGE_GIVING");
  await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
  await requireCurrentChurch();
  return <OnlineGivingSettings />;
}
