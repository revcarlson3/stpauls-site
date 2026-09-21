import { requireGlobalAdmin } from "@/lib/global-admin";
import GlobalAdminAudit from "./audit";

export default async function GlobalAdminAuditPage() {
  await requireGlobalAdmin();
  return <GlobalAdminAudit />;
}
