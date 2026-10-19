import Link from "next/link";

export function MaintenancePage({ publicSiteName, reason = "maintenance" }: { publicSiteName: string; reason?: "maintenance" | "subscription" }) {
  const subscriptionRequired = reason === "subscription";
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-5 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-ink/10 bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">{subscriptionRequired ? "Subscription required" : "Temporarily unavailable"}</p>
        <h1 className="mt-4 font-serif text-4xl">{subscriptionRequired ? `${publicSiteName} is not active yet` : `${publicSiteName} is taking a break`}</h1>
        <p className="mx-auto mt-4 max-w-xl text-ink/65">{subscriptionRequired ? "This public website will become available after the site subscription is activated." : "The public website is currently being updated. Please check back soon."}</p>
        <Link href="/admin/login" className="focus-ring mt-8 inline-flex rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Log in</Link>
      </section>
    </main>
  );
}
