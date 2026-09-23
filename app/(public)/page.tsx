import Link from "next/link";
import { Button, Card, Container } from "@/components/ui";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PublishedPageShell } from "@/components/page-renderer";
import { PagePasswordGate } from "@/components/page-password-gate";
import { hasPageAccess } from "@/lib/page-access";
import { isPublicSiteEnabled } from "@/lib/modules";
import { headers } from "next/headers";
import { isPlatformHost } from "@/lib/platform-host";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (isPlatformHost(headers().get("host"))) return <PlatformLandingPage />;
  if (!(await isPublicSiteEnabled())) redirect("/admin/login");
  const homePage = await db.page.findFirst({ where: { isHome: true, OR: [{ status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, { status: "DRAFT", publishAt: { lte: new Date() } }] }, select: { id: true, slug: true, title: true, blocks: true, pageThemeFamily: true, pageThemeWidth: true, showHeader: true, showFooter: true, fullScreen: true, passwordHash: true } });
  if (homePage && !hasPageAccess(homePage.id, homePage.passwordHash)) return <PagePasswordGate pageId={homePage.id} title={homePage.title} />;
  if (homePage) return <PublishedPageShell title={homePage.title} blocks={homePage.blocks} pageId={homePage.id} pageSlug={homePage.slug} pageThemeFamily={homePage.pageThemeFamily} pageThemeWidth={homePage.pageThemeWidth} editHref={`/admin/editor/${homePage.id}`} showHeader={homePage.showHeader} showFooter={homePage.showFooter} fullScreen={homePage.fullScreen} />;
  return (
    <main>
      <section className="site-section bg-sand">
        <Container className="grid items-center gap-12 md:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Come as you are</p>
            <h1 className="max-w-2xl font-serif text-5xl leading-[1.08] tracking-tight sm:text-7xl">
              A place to belong.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink/70">
              We are a community learning to live with courage, compassion, and curiosity. There is room for you here.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button>Plan a visit</Button>
              <Link href="#gather" className="focus-ring inline-flex items-center rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold hover:border-coral hover:text-coral">
                Find your people
              </Link>
            </div>
          </div>
          <div aria-label="Abstract illustration" className="relative aspect-square overflow-hidden rounded-[2.5rem] bg-ink p-8 text-white sm:p-12">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-coral" />
            <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full border-[28px] border-mist/30" />
            <div className="relative flex h-full items-end">
              <p className="max-w-xs font-serif text-3xl leading-tight">“There is room for you here.”</p>
            </div>
          </div>
        </Container>
      </section>
      <section id="gather" className="site-section">
        <Container>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Gather</p>
          <h2 className="mt-3 font-serif text-4xl">Make space for what matters.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Card><h3 className="font-serif text-2xl">Worship</h3><p className="mt-3 leading-7 text-ink/65">Sundays at 9 and 11. Come for the music, stay for the welcome.</p></Card>
            <Card><h3 className="font-serif text-2xl">Formation</h3><p className="mt-3 leading-7 text-ink/65">Practice a faith that meets you in the questions and the everyday.</p></Card>
            <Card id="belong"><h3 className="font-serif text-2xl">Community</h3><p className="mt-3 leading-7 text-ink/65">Find a table, a conversation, and people walking alongside you.</p></Card>
          </div>
        </Container>
      </section>
    </main>
  );
}

function PlatformLandingPage() {
  return (
    <main className="min-h-screen bg-sand">
      <section className="site-section">
        <Container className="grid items-center gap-12 md:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-coral">mychurch.one</p>
            <h1 className="max-w-3xl font-serif text-5xl leading-[1.08] tracking-tight sm:text-7xl">The simple home for your church online.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink/70">Bring your public website, membership, communications, giving, and administration together in one welcoming platform.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="focus-ring inline-flex items-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Start your church</Link>
              <Link href="/admin/login" className="focus-ring inline-flex items-center rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold">Sign in</Link>
            </div>
          </div>
          <Card className="bg-ink text-white"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-mist/70">Built for ministry</p><h2 className="mt-4 font-serif text-3xl">Everything in one calm workspace.</h2><ul className="mt-6 grid gap-3 text-sm text-mist/80"><li>Public pages and media</li><li>Membership and pastoral care</li><li>Events, giving, and communications</li><li>Secure tenant administration</li></ul></Card>
        </Container>
      </section>
      <section className="site-section border-y border-ink/10 bg-white"><Container><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Clear pricing</p><h2 className="mt-3 font-serif text-4xl">One platform, one predictable plan.</h2><div className="mt-8 grid gap-5 md:grid-cols-3"><Card><h3 className="font-serif text-2xl">Starter</h3><p className="mt-3 text-3xl font-semibold">$49<span className="text-base font-normal text-ink/55">/month</span></p><p className="mt-3 text-sm leading-6 text-ink/65">Core public website and church administration tools.</p></Card><Card><h3 className="font-serif text-2xl">Growth</h3><p className="mt-3 text-3xl font-semibold">$99<span className="text-base font-normal text-ink/55">/month</span></p><p className="mt-3 text-sm leading-6 text-ink/65">Membership, communications, giving, and reporting.</p></Card><Card><h3 className="font-serif text-2xl">Start safely</h3><p className="mt-3 text-sm leading-6 text-ink/65">Create a pending account first. Billing and provider confirmation happen later through the secure admin flow.</p><Link href="/signup" className="mt-5 inline-flex font-semibold text-coral hover:underline">Create an account →</Link></Card></div></Container></section>
    </main>
  );
}
