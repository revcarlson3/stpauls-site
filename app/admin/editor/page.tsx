import { Container } from "@/components/ui";
import EditorCanvas from "./editor-canvas";

export default function EditorPage() {
  return (
    <main>
      <Container className="py-10 sm:py-14">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Draft page</p>
            <h1 className="mt-2 font-serif text-4xl">Welcome page</h1>
            <p className="mt-2 text-ink/60">Arrange content blocks on a responsive 12-column canvas.</p>
          </div>
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Local prototype</span>
        </div>
        <EditorCanvas />
      </Container>
    </main>
  );
}

