import { Container } from "@/components/ui";

export function ServicesModulePage({ title, description }: { title: string; description: string }) {
  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Services and sermons</p>
        <h1 className="mt-2 font-serif text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-ink/60">{description}</p>
        <div className="mt-8 rounded-[var(--site-radius-card)] border border-dashed border-ink/20 bg-white/60 p-8 text-sm text-ink/60">
          This area is ready for the {title.toLowerCase()} tools.
        </div>
      </Container>
    </main>
  );
}
