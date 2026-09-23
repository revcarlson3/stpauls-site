import { requireGlobalAdmin } from "@/lib/global-admin";
import Billing from "./billing";
export default async function GlobalAdminBillingPage() { await requireGlobalAdmin(); return <Billing />; }
