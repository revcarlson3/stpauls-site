import Link from "next/link";
import { Container } from "@/components/ui";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-mist/40">
      <header className="border-b border-ink/10 bg-white">
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <Link href="/admin/editor" className="focus-ring font-serif text-xl font-bold">Site studio</Link>
            <p className="text-xs text-ink/55">Content workspace</p>
          </div>
          <nav aria-label="Admin navigation" className="flex gap-4 text-sm font-medium">
            <Link className="focus-ring text-coral" href="/admin/editor">Editor</Link>
            <Link className="focus-ring text-ink/60 hover:text-coral" href="/">View site</Link>
          </nav>
        </Container>
      </header>
      {children}
    </div>
  );
}

