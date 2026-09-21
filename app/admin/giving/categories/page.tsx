import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { CategoriesPage } from "./categories-page";

export default async function GivingCategoriesPage() {
  const user = await requirePermission("MANAGE_GIVING");
  await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
  await requireCurrentChurch();
  return <CategoriesPage />;
}
