import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE_REVISION } from "@/lib/site";
import { Container } from "@/components/ui";
import { PublicAccountNav } from "@/components/public-account-nav";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
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
          <Link className="focus-ring hover:text-coral" href="#gather">Gather</Link>
          <Link className="focus-ring hover:text-coral" href="#belong">Belong</Link>
          <PublicAccountNav authenticated={Boolean(user)} />
        </nav>
      </Container>
    </header>
  );
}

