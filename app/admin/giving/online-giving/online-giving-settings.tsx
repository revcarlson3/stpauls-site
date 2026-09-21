"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Container } from "@/components/ui";

type TithelyTokenResponse = {
  error?: { message?: string };
  token?: { id?: string };
};

type TithelyClient = {
  createCardEntry: (selector: string, style: Record<string, unknown>) => void;
  createCardToken: (callback: (response: TithelyTokenResponse) => void) => void;
  destroyCardEntry?: () => void;
};

declare global {
  interface Window {
    Tithely?: new (publicKey: string) => TithelyClient;
  }
}

export function OnlineGivingSettings() {
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [privateKeyConfigured, setPrivateKeyConfigured] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [copiedValue, setCopiedValue] = useState("");
  const [testChargeMessage, setTestChargeMessage] = useState("");
  const [cardEntryMessage, setCardEntryMessage] = useState("");
  const [testChargeBusy, setTestChargeBusy] = useState(false);
  const [testChargeForm, setTestChargeForm] = useState({
    amount: "5.00",
    email: "test@example.com",
    firstName: "Test",
    lastName: "Donor",
    givingType: "General Fund",
  });
  const cardEntryRef = useRef<HTMLDivElement>(null);
  const tithelyRef = useRef<TithelyClient | null>(null);

  async function copyTestValue(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedValue(label);
    window.setTimeout(() => setCopiedValue(""), 1800);
  }

  async function loadSettings(targetEnvironment?: "test" | "live") {
    try {
      const query = targetEnvironment
        ? `?environment=${targetEnvironment}`
        : "";
      const response = await fetch(`/api/giving/online-giving${query}`, {
        cache: "no-store",
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setEnabled(value.enabled === true);
      setPublicKey(value.tithelyPublicKey ?? "");
      setPrivateKeyConfigured(value.tithelyPrivateKeyConfigured === true);
      setOrganizationId(value.tithelyOrganizationId ?? "");
      setEnvironment(value.tithelyEnvironment === "live" ? "live" : "test");
      setPrivateKey("");
      setLoaded(true);
    } catch {
      setMessage("Unable to load online giving settings.");
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function selectEnvironment(value: "test" | "live") {
    setMessage("");
    await loadSettings(value);
  }

  useEffect(() => {
    if (!enabled || environment !== "test" || !publicKey || !cardEntryRef.current) {
      return;
    }

    let cancelled = false;
    let renderTimer: number | undefined;
    let retryTimer: number | undefined;
    const cardStyle = {
      base: {
        color: "#32325d",
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": { color: "#aab7c4" },
      },
      invalid: { color: "#fa755a", iconColor: "#fa755a" },
    };
    const renderCardEntry = () => {
      if (cancelled || !cardEntryRef.current || !tithelyRef.current) return;
      tithelyRef.current.createCardEntry("#tithely-test-card-entry", cardStyle);
      window.setTimeout(() => {
        if (cancelled) return;
        const iframe = cardEntryRef.current?.querySelector("iframe");
        if (iframe) {
          iframe.setAttribute("scrolling", "no");
          iframe.style.display = "block";
          iframe.style.width = "100%";
          iframe.style.height = "56px";
          iframe.style.border = "0";
          setCardEntryMessage("");
        } else {
          setCardEntryMessage(
            "Tithe.ly has not loaded the card fields. Confirm that the saved test public key is valid.",
          );
        }
      }, 1500);
    };
    const initialize = () => {
      if (cancelled || !cardEntryRef.current || !window.Tithely) return;
      tithelyRef.current?.destroyCardEntry?.();
      const tithely = new window.Tithely(publicKey);
      tithelyRef.current = tithely;
      setCardEntryMessage("Loading secure Tithe.ly card fields...");
      renderTimer = window.setTimeout(renderCardEntry, 1500);
      retryTimer = window.setTimeout(renderCardEntry, 4500);
    };

    const scriptId = "tithely-js-test";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.Tithely) initialize();
      else existingScript.addEventListener("load", initialize, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://tithelydev.com/api-js/v2/tithely.js";
      script.async = true;
      script.addEventListener("load", initialize, { once: true });
      script.addEventListener(
        "error",
        () => setTestChargeMessage("Unable to load Tithe.ly test payment fields."),
        { once: true },
      );
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (renderTimer) window.clearTimeout(renderTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
      tithelyRef.current?.destroyCardEntry?.();
      tithelyRef.current = null;
    };
  }, [enabled, environment, publicKey]);

  async function submitTestCharge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTestChargeMessage("");
    if (!tithelyRef.current) {
      setTestChargeMessage("Tithe.ly test payment fields are not ready yet.");
      return;
    }
    setTestChargeBusy(true);
    tithelyRef.current.createCardToken(async (response) => {
      const token = response.token?.id;
      if (response.error || !token) {
        setTestChargeMessage(response.error?.message ?? "Tithe.ly could not tokenize the card.");
        setTestChargeBusy(false);
        return;
      }
      const amount = Math.round(Number(testChargeForm.amount) * 100);
      const apiResponse = await fetch("/api/giving/online-giving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...testChargeForm, amount, token }),
      });
      const result = await apiResponse.json().catch(() => null);
      setTestChargeMessage(
        apiResponse.ok
          ? `Test charge completed${result?.result?.charge_status ? `: ${result.result.charge_status}` : "."}`
          : result?.error ?? "Unable to complete the Tithe.ly test charge.",
      );
      setTestChargeBusy(false);
    });
  }

  async function save() {
    setMessage("");
    const response = await fetch("/api/giving/online-giving", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        publicKey,
        privateKey,
        organizationId,
        environment,
      }),
    });
    const value = await response.json();
    if (!response.ok) {
      setMessage(value.error ?? "Unable to update online giving.");
      return;
    }
    window.dispatchEvent(new Event("online-giving-settings-updated"));
    setPrivateKey("");
    setPrivateKeyConfigured(
      value.tithelyPrivateKeyConfigured === true || privateKeyConfigured,
    );
    setMessage(value.enabled ? "Online giving is now enabled." : "Online giving is now disabled.");
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
          Giving and pledges
        </p>
        <h1 className="mt-2 font-serif text-4xl">Online giving</h1>
        <div className="mt-8 grid w-full max-w-none gap-6 lg:grid-cols-12">
        <Card className="min-w-0 p-6 lg:col-span-3">
          <h2 className="font-serif text-2xl">Member access</h2>
          <p className="mt-2 leading-7 text-ink/60">
            Enable this setting to show Online giving in the My Membership menu.
            The giving features will be added here as they are built.
          </p>
          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">Enable online giving for members</span>
            <button
              type="button"
              role="switch"
              aria-label="Enable online giving for members"
              aria-checked={enabled}
              disabled={!loaded}
              onClick={() => setEnabled((current) => !current)}
              className={`focus-ring relative h-8 w-14 shrink-0 rounded-full transition ${enabled ? "bg-coral" : "bg-ink/25"} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${enabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
            <span className="sr-only">{enabled ? "On" : "Off"}</span>
          </div>
          {enabled && (
            <div className="mt-8 grid gap-6 border-t border-ink/10 pt-6">
              <div>
                <h3 className="font-serif text-xl">Tithe.ly API configuration</h3>
                <p className="mt-1 text-sm text-ink/60">
                  Keep the private key on the server. It is encrypted before storage.
                </p>
              </div>
              <label className="grid gap-1 text-sm font-semibold">
                Public key
                <input value={publicKey} onChange={(event) => setPublicKey(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="pub_..." autoComplete="off" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Private key
                <input type="password" value={privateKey} onChange={(event) => setPrivateKey(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder={privateKeyConfigured ? "Leave blank to keep current key" : "pri_..."} autoComplete="new-password" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Organization ID
                <input value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="org_..." autoComplete="off" />
              </label>
              <div className="grid gap-2">
                <span className="text-sm font-semibold">Tithe.ly environment</span>
                <div className="inline-flex w-fit rounded-full border border-ink/15 bg-mist/50 p-1">
                  {(["test", "live"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={environment === value}
                      onClick={() => void selectEnvironment(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${environment === value ? "bg-white text-coral shadow-sm" : "text-ink/60 hover:text-ink"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="mt-6 flex items-center gap-4">
            <Button type="button" disabled={!loaded} onClick={() => void save()}>
              Save setting
            </Button>
            {message && <p role="status" className="text-sm text-ink/60">{message}</p>}
          </div>
        </Card>
        <Card className="min-w-0 p-6 lg:col-span-3">
          <h2 className="font-serif text-2xl">Create Tithe.ly accounts</h2>
          <p className="mt-2 leading-7 text-ink/60">
            Tithe.ly requires both a live account and a separate test account
            before API development can begin. Use the test account to safely
            validate tokenization and donations without processing real gifts.
            Your existing church account can be used for live giving.
          </p>
          <div className="mt-6 grid gap-3">
            <a
              href="https://signup.tithe.ly/verify"
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded-full bg-coral px-5 py-3 text-center text-sm font-semibold text-white hover:bg-coral/85"
            >
              Create live Tithe.ly account
            </a>
            <a
              href="https://signup.tithelyqa.com/"
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded-full border border-coral px-5 py-3 text-center text-sm font-semibold text-coral hover:bg-coral/10"
            >
              Create test Tithe.ly account
            </a>
          </div>
          <div className="mt-8 border-t border-ink/10 pt-6">
            <h3 className="font-serif text-xl">Request API access</h3>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Tithe.ly API access is available by request for churches that use
              or are moving to Tithe.ly. After approval, Tithe.ly provides the
              public and private API keys needed for this page. Never share the
              private key in browser code.
            </p>
            <a
              href="https://docs.tithe.ly/reference/introduction"
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-4 inline-block text-sm font-semibold text-coral underline underline-offset-4"
            >
              Read the Tithe.ly API documentation
            </a>
          </div>
        </Card>
        {enabled && environment === "test" && (
          <Card className="min-w-0 p-6 lg:col-span-3">
            <h2 className="font-serif text-2xl">Tithe.ly test data</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Use these values only with the Tithe.ly test environment. Card
              details are entered into Tithely.js; never send raw payment
              information to this application.
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              {[
                ["Visa card", "4111111111111111", "Any 3-digit CVC; future expiration"],
                ["American Express", "378282246310005", "Any 4-digit CVC; future expiration"],
                ["US bank account", "000123456789", "Use with the routing number below"],
                ["US routing number", "110000000", "Test routing number"],
                ["SSN / EIN / tax ID", "000000000", "Test identity value"],
              ].map(([label, value, detail]) => (
                <div key={label} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 bg-mist/40 px-3 py-3">
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="font-mono text-ink/75">{value}</p>
                    <p className="text-xs text-ink/50">{detail}</p>
                  </div>
                  <button
                    type="button"
                    className="focus-ring rounded-full border border-coral px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral/10"
                    onClick={() => void copyTestValue(label, value)}
                  >
                    {copiedValue === label ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
        {enabled && environment === "test" && (
          <Card className="min-w-0 p-6 lg:col-span-3">
            <h2 className="font-serif text-2xl">Test a card charge</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Tithe.ly hosts the card fields in an iframe. This page receives
              only a short-lived token, which the server sends to the test
              charge endpoint using your encrypted private key.
            </p>
            <div
              id="tithely-test-card-entry"
              ref={cardEntryRef}
              className="mt-4 min-h-16 overflow-hidden rounded-lg border border-ink/15 bg-white px-3 py-2"
            />
            {cardEntryMessage && (
              <p role="status" className="mt-2 text-xs text-ink/60">
                {cardEntryMessage}
              </p>
            )}
            <form onSubmit={(event) => void submitTestCharge(event)} className="mt-4 grid min-w-0 gap-3">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {([
                  ["firstName", "First name"],
                  ["lastName", "Last name"],
                  ["email", "Email"],
                  ["amount", "Amount (USD)"],
                  ["givingType", "Giving type"],
                ] as const).map(([field, label]) => (
                  <label key={field} className="grid min-w-0 gap-1 text-sm font-semibold">
                    {label}
                    <input
                      required
                      type={field === "email" ? "email" : field === "amount" ? "number" : "text"}
                      min={field === "amount" ? "0.50" : undefined}
                      step={field === "amount" ? "0.01" : undefined}
                      value={testChargeForm[field]}
                      onChange={(event) =>
                        setTestChargeForm((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      className="focus-ring min-w-0 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal"
                    />
                  </label>
                ))}
              </div>
              <Button type="submit" disabled={testChargeBusy || !publicKey || !privateKeyConfigured}>
                {testChargeBusy ? "Testing charge..." : "Run test charge"}
              </Button>
              {testChargeMessage && (
                <p role="status" className="text-sm text-ink/60">{testChargeMessage}</p>
              )}
            </form>
          </Card>
        )}
        </div>
      </Container>
    </main>
  );
}
