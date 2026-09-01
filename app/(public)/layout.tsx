import Link from "next/link";
import { Container } from "@/components/ui";
import { SITE_REVISION } from "@/lib/site";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-sand/90">
        <Container className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="focus-ring font-serif text-xl font-bold tracking-tight">
              St. Paul&apos;s
            </Link>
            <span className="rounded-full bg-mist px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink/55">
              Rev. {SITE_REVISION}
            </span>
          </div>
          <nav aria-label="Primary navigation" className="flex items-center gap-5 text-sm font-medium">
            <Link className="focus-ring hover:text-coral" href="#gather">
              Gather
            </Link>
            <Link className="focus-ring hover:text-coral" href="#belong">
              Belong
            </Link>
            <Link className="focus-ring rounded-full border border-ink/20 px-4 py-2 hover:border-coral hover:text-coral" href="/admin/editor">
              Editor
            </Link>
          </nav>
        </Container>
      </header>
      {children}
      <footer className="border-t border-ink/10 py-8">
        <Container className="text-sm text-ink/60">St. Paul&apos;s · A place to belong</Container>
      </footer>
    </div>
  );
}
