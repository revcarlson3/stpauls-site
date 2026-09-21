import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { ContributionsPage } from "./contributions-page";

export default async function GivingContributionsPage() {
  const user = await requirePermission("MANAGE_GIVING");
  await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
  await requireCurrentChurch();
  return <ContributionsPage />;
}
