import Link from "next/link";
import { Button, Card, Container } from "@/components/ui";

export default function HomePage() {
  return (
    <main>
      <section className="bg-sand pb-20 pt-16 sm:pb-28 sm:pt-24">
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
      <section id="gather" className="py-20 sm:py-24">
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

