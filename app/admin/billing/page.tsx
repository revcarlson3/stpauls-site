import { requirePermission } from "@/lib/auth";
import BillingPage from "./billing";
export default async function AdminBillingPage() { await requirePermission("MANAGE_SETTINGS"); return <BillingPage />; }
