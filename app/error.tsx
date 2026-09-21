"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled application error.", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-sand px-6 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-ink/10 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Something went wrong</p>
        <h1 className="mt-3 font-serif text-4xl">We could not load this page.</h1>
        <p className="mt-4 text-sm leading-6 text-ink/60">Your data has not been changed. Try loading the page again, or return to the home page.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Try again</button>
          <a href="/" className="focus-ring rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold">Go home</a>
        </div>
      </section>
    </main>
  );
}
