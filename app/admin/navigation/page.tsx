import { Container } from "@/components/ui";
import { MenuManager } from "@/components/menu-manager";

export default function NavigationPage() {
  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site structure</p>
        <h1 className="mt-2 font-serif text-4xl">Menus</h1>
        <p className="mt-2 text-ink/60">Manage navigation menus and their links.</p>
        <div className="mt-8">
          <MenuManager />
        </div>
      </Container>
    </main>
  );
}
