import { requirePermission } from "@/lib/auth";
import BillingPage from "./billing";
export default async function AdminBillingPage() { await requirePermission("ACCESS_ADMIN", { allowUnsubscribed: true }); return <BillingPage />; }
