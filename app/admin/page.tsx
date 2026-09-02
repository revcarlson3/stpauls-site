import { Container } from "@/components/ui";
import ActivityFeed from "./activity-feed";

export default async function AdminPage() {
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Overview</p><h1 className="mt-2 font-serif text-4xl">Admin Dashboard</h1><ActivityFeed /></Container></main>;
}
