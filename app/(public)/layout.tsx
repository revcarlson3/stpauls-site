import { Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { AdminDrawer } from "@/components/admin-drawer";

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen">
      {user && <AdminDrawer />}
      {children}
      <footer className="border-t border-ink/10 py-8">
        <Container className="text-sm text-ink/60">St. Paul&apos;s · A place to belong</Container>
      </footer>
    </div>
  );
}
