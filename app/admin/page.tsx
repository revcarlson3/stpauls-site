import { Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import AdminDashboard from "./admin-dashboard";

export default async function AdminPage() {
  const user = await getCurrentUser();
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Welcome, {user?.name ?? "there"}!</p><AdminDashboard /></Container></main>;
}
