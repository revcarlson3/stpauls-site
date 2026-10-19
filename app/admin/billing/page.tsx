import { requireCurrentChurch } from "@/lib/tenant";
import BillingPage from "./billing";
export default async function AdminBillingPage() { await requireCurrentChurch({ allowUnsubscribed: true }); return <BillingPage />; }
