"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Container, Notification } from "@/components/ui";

type Props = { initial: { planId?: string; provider?: string; interval?: string; couponCode?: string; customDomain?: string; domainChoice?: string; domainHostname?: string; domainRegistrationPrice?: string } };
type Quote = { planName: string; provider: string; interval: string; currency: string; planPrice: number; addOnPrice: number; addOnSelected: boolean; domainChoice: "PLATFORM_SUBDOMAIN" | "OWN_DOMAIN" | "NEW_DOMAIN"; domainHostname: string | null; subtotal: string; discount: string; total: string; couponCode: string | null };

export default function CheckoutReview({ initial }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [authorization, setAuthorization] = useState<{ checkoutUrl: string | null; domainCheckoutUrl: string | null } | null>(null);
  const payload = { planId: initial.planId, provider: initial.provider, interval: initial.interval, couponCode: initial.couponCode || undefined, domainChoice: initial.domainChoice, domainHostname: initial.domainHostname, domainRegistrationPrice: initial.domainRegistrationPrice ? Number(initial.domainRegistrationPrice) : undefined, customDomain: initial.customDomain === "1" };

  useEffect(() => {
    void fetch("/api/billing/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); setQuote(value.quote); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to prepare checkout."));
  }, [initial.planId, initial.provider, initial.interval, initial.couponCode, initial.customDomain]);

  async function confirm() {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/billing/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const value = await response.json();
    if (!response.ok) { setError(value.error); setSubmitting(false); return; }
    if (value.subscription?.checkoutUrl || value.subscription?.domainCheckoutUrl) { setAuthorization({ checkoutUrl: value.subscription.checkoutUrl, domainCheckoutUrl: value.subscription.domainCheckoutUrl }); setSubmitting(false); return; }
    setComplete(true);
    setSubmitting(false);
  }

  const domainLabel = quote?.domainChoice === "PLATFORM_SUBDOMAIN" ? "Automatically created subdomain" : quote?.domainChoice === "OWN_DOMAIN" ? `Use my own domain${quote.domainHostname ? ` (${quote.domainHostname})` : ""}` : `Create a new domain${quote?.domainHostname ? ` (${quote.domainHostname})` : ""}`;
  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><Link href="/admin/billing" className="text-sm font-semibold text-coral">← Back to plans</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Checkout review</p><h1 className="mt-2 font-serif text-4xl">{complete ? "Subscription activated" : "Review your subscription"}</h1>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}{authorization ? <Card className="mt-8 max-w-xl p-6"><h2 className="font-serif text-2xl">Authorize billing</h2><p className="mt-2 text-sm text-ink/70">Complete each secure provider authorization. The subscription and annual domain renewal are separate charges.</p><div className="mt-5 grid gap-3">{authorization.checkoutUrl && <a href={authorization.checkoutUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-coral px-4 py-3 text-center text-sm font-semibold text-white">Authorize subscription</a>}{authorization.domainCheckoutUrl && <a href={authorization.domainCheckoutUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-coral px-4 py-3 text-center text-sm font-semibold text-coral">Authorize annual domain fee</a>}</div></Card> : complete ? <Card className="mt-8 p-6"><p className="text-lg font-semibold">Nothing is due today.</p><p className="mt-2 text-sm text-ink/70">Your subscription is active and all included site modules are now available.</p><Link href="/admin" className="mt-6 inline-block rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white">Go to administration</Link></Card> : <Card className="mt-8 max-w-xl p-6">{quote ? <><h2 className="font-serif text-2xl">{quote.planName}</h2><dl className="mt-5 grid gap-3 text-sm"><div className="flex justify-between"><dt>Billing interval</dt><dd>{quote.interval.toLowerCase().replace("_", "-")}</dd></div><div className="flex justify-between"><dt>Domain</dt><dd className="text-right">{domainLabel}</dd></div><div className="flex justify-between"><dt>Plan price</dt><dd>{quote.currency} {quote.planPrice.toFixed(2)}</dd></div>{quote.addOnSelected && <div className="flex justify-between"><dt>New domain add-on</dt><dd>{quote.currency} {quote.addOnPrice.toFixed(2)} annually</dd></div>}<div className="flex justify-between border-t pt-3 font-semibold"><dt>Subtotal</dt><dd>{quote.currency} {quote.subtotal}</dd></div>{quote.couponCode && <div className="flex justify-between text-green-700"><dt>Coupon ({quote.couponCode})</dt><dd>-{quote.currency} {quote.discount}</dd></div>}<div className="flex justify-between border-t pt-3 text-lg font-semibold"><dt>Due today</dt><dd>{quote.currency} {quote.total}</dd></div></dl><p className="mt-5 text-sm text-ink/60">{Number(quote.total) === 0 ? "No payment method is required for the subscription. The annual domain fee has a separate authorization." : `Confirm to continue to ${quote.provider} secure checkout.`}</p><button type="button" disabled={submitting} onClick={() => void confirm()} className="mt-6 rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Preparing..." : Number(quote.total) === 0 ? "Activate subscription" : `Continue with ${quote.provider}`}</button></> : !error && <p className="text-sm text-ink/60">Preparing your checkout summary…</p>}</Card>}</Container></main>;
}
