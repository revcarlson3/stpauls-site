import { requirePermission } from "@/lib/auth";
import { DomainsWorkspace } from "./workspace";

export default async function AdminDomainsPage() {
  await requirePermission("MANAGE_SETTINGS");
  return <DomainsWorkspace />;
}
