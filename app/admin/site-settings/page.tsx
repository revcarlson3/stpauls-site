"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Button, Container, Notification } from "@/components/ui";
import { MODULES } from "@/lib/modules";

export default function SiteSettingsPage() {
  const pathname = usePathname();
  const messagingPage = pathname.endsWith("/messaging");
  const [settings, setSettings] = useState({ siteName: "St. Paul's", siteTagline: "A place to belong.", emailProvider: "smtp", emailApiKey: "", emailApiSecret: "", emailApiDomain: "", emailApiRegion: "", smtpHost: "", smtpPort: 587, smtpUser: "", smtpPassword: "", emailFrom: "", smsProvider: "twilio", smsAccountId: "", smsAuthSecret: "", smsFrom: "", registrationCode: "", pollinationsApiKey: "", pollinationsApiKeyConfigured: false, membershipMessageRecipientLimit: 200, publicSiteEnabled: true, enabledModules: [] as string[] });
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger">("success");
  const [testRecipient, setTestRecipient] = useState("");
  const [testingChannel, setTestingChannel] = useState<"EMAIL" | "SMS" | null>(null);
  const [canManageModules, setCanManageModules] = useState(false);

  useEffect(() => {
    void Promise.all([fetch("/api/site-settings"), fetch("/api/modules")]).then(async ([settingsResponse, modulesResponse]) => {
      if (!settingsResponse.ok) throw new Error("Unable to load site settings.");
      const value = await settingsResponse.json();
      const modules = modulesResponse.ok ? await modulesResponse.json() : {};
      setCanManageModules(Boolean(modules.canManageModules));
      setSettings((current) => ({
        ...current,
        ...value,
        ...("enabledModules" in value ? { enabledModules: value.enabledModules.filter((slug: unknown): slug is string => typeof slug === "string") } : {}),
        smtpPassword: "", emailApiKey: "", emailApiSecret: "", smsAuthSecret: "", pollinationsApiKey: ""
      }));
    }).catch((error: Error) => { setMessageVariant("danger"); setMessage(error.message); });
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = canManageModules ? settings : { ...settings, enabledModules: undefined };
    const response = await fetch("/api/site-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Settings saved." : "Unable to save site settings.");
    if (response.ok) {
      setSettings((current) => ({ ...current, smtpPassword: "", emailApiKey: "", emailApiSecret: "", smsAuthSecret: "", pollinationsApiKeyConfigured: current.pollinationsApiKeyConfigured || Boolean(current.pollinationsApiKey), pollinationsApiKey: "" }));
      window.dispatchEvent(new Event("site-settings-updated"));
    }

  }

  async function sendTest(channel: "EMAIL" | "SMS") {
    setMessage("");
    setMessageVariant("success");
    setTestingChannel(channel);
    try {
      const response = await fetch("/api/site-settings/messaging/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, recipient: testRecipient }) });
      const value = await response.json().catch(() => ({}));
      setMessageVariant(response.ok ? "success" : "danger");
      setMessage(response.ok ? `${channel === "EMAIL" ? "Email" : "SMS"} test sent.` : value.error ?? "Unable to send test message.");
    } finally {
      setTestingChannel(null);
    }
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p>
        <h1 className="mt-2 font-serif text-4xl">{messagingPage ? "Messaging Settings" : "Site Settings"}</h1>
        <form autoComplete="off" onSubmit={(event) => void save(event)} className="mt-8 grid max-w-2xl gap-6">
          {messagingPage && <section className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">Email messaging</h2>
            <p className="text-sm text-ink/60">Choose the email service used throughout the site. Secrets are encrypted and never returned to the browser.</p>
            <label className="grid gap-1 text-sm font-semibold">Email provider<select value={settings.emailProvider} onChange={(event) => setSettings({ ...settings, emailProvider: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="smtp">Generic SMTP</option><option value="sendgrid">SendGrid API</option><option value="mailgun">Mailgun API</option><option value="postmark">Postmark API</option><option value="resend">Resend API</option><option value="amazon-ses">Amazon SES API</option></select></label>
            {settings.emailProvider === "smtp" ? <><label className="grid gap-1 text-sm font-semibold">SMTP host<input required autoComplete="off" value={settings.smtpHost} onChange={(event) => setSettings({ ...settings, smtpHost: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">SMTP port<input required autoComplete="off" type="number" value={settings.smtpPort} onChange={(event) => setSettings({ ...settings, smtpPort: Number(event.target.value) })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">SMTP username<input required autoComplete="off" value={settings.smtpUser} onChange={(event) => setSettings({ ...settings, smtpUser: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">SMTP password<input type="password" autoComplete="new-password" placeholder="Leave blank to keep current" value={settings.smtpPassword} onChange={(event) => setSettings({ ...settings, smtpPassword: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></> : <><label className="grid gap-1 text-sm font-semibold">{settings.emailProvider === "mailgun" ? "API key" : settings.emailProvider === "amazon-ses" ? "Access key ID" : "API key / server token"}<input type="password" autoComplete="new-password" placeholder="Leave blank to keep current" value={settings.emailApiKey} onChange={(event) => setSettings({ ...settings, emailApiKey: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">{settings.emailProvider === "amazon-ses" ? "Secret access key" : "API secret (if required)"}<input type="password" autoComplete="new-password" placeholder="Leave blank to keep current" value={settings.emailApiSecret} onChange={(event) => setSettings({ ...settings, emailApiSecret: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>{settings.emailProvider === "mailgun" && <label className="grid gap-1 text-sm font-semibold">Mailgun domain<input required autoComplete="off" value={settings.emailApiDomain} onChange={(event) => setSettings({ ...settings, emailApiDomain: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>}{settings.emailProvider === "amazon-ses" && <label className="grid gap-1 text-sm font-semibold">AWS region<input required autoComplete="off" value={settings.emailApiRegion} onChange={(event) => setSettings({ ...settings, emailApiRegion: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>}</>}
            <label className="grid gap-1 text-sm font-semibold">From address<input required type="email" value={settings.emailFrom} onChange={(event) => setSettings({ ...settings, emailFrom: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          </section>}
          {messagingPage && <section className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">Membership message limits</h2>
            <p className="text-sm text-ink/60">Set the maximum number of eligible recipients included in one membership email or SMS send. The default is 200.</p>
            <label className="grid gap-1 text-sm font-semibold">Maximum recipients per message<input required type="number" min={1} max={5000} value={settings.membershipMessageRecipientLimit} onChange={(event) => setSettings({ ...settings, membershipMessageRecipientLimit: Number(event.target.value) })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          </section>}
          {messagingPage && <section className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">Test delivery</h2>
            <p className="text-sm text-ink/60">Send a test through the selected providers. Tests go only to the address or number entered here.</p>
            <label className="grid gap-1 text-sm font-semibold">Test email or phone number<input autoComplete="off" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="you@example.com or +15551234567" /></label>
            <div className="flex flex-wrap gap-3"><button type="button" disabled={testingChannel !== null || !testRecipient.trim()} onClick={() => void sendTest("EMAIL")} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{testingChannel === "EMAIL" ? "Sending…" : "Test email"}</button><button type="button" disabled={testingChannel !== null || !testRecipient.trim()} onClick={() => void sendTest("SMS")} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{testingChannel === "SMS" ? "Sending…" : "Test SMS"}</button></div>
          </section>}
          {messagingPage && <section className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">SMS messaging</h2>
            <p className="text-sm text-ink/60">These provider settings are shared by SMS messaging and text-message verification.</p>
            <label className="grid gap-1 text-sm font-semibold">Provider<select value={settings.smsProvider} onChange={(event) => setSettings({ ...settings, smsProvider: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="twilio">Twilio</option><option value="vonage">Vonage</option><option value="aws-sns">Amazon SNS</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Account/API ID<input value={settings.smsAccountId} onChange={(event) => setSettings({ ...settings, smsAccountId: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Secret<input type="password" placeholder="Leave blank to keep current" value={settings.smsAuthSecret} onChange={(event) => setSettings({ ...settings, smsAuthSecret: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">{settings.smsProvider === "twilio" ? "Twilio phone number" : "Sender ID"}<input value={settings.smsFrom} onChange={(event) => setSettings({ ...settings, smsFrom: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          </section>}
          {!messagingPage && <section className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">Administration identity</h2>
            <p className="text-sm text-ink/60">Set the title and subtitle shown in the administration header. These values are available even when the public website is disabled.</p>
            <label className="grid gap-1 text-sm font-semibold">Administration title<input required value={settings.siteName} onChange={(event) => setSettings({ ...settings, siteName: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Administration subtitle<input value={settings.siteTagline} onChange={(event) => setSettings({ ...settings, siteTagline: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          </section>}
          {!messagingPage && <section className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">AI image generation</h2>
            <p className="text-sm text-ink/60">Connect Pollinations.AI to enable Media Library image generation. The API key is encrypted and never returned to the browser.</p>
            <label className="grid gap-1 text-sm font-semibold">Pollinations.AI API key<input type="password" autoComplete="new-password" placeholder={settings.pollinationsApiKeyConfigured ? "Leave blank to keep current key" : "Enter Pollinations.AI API key"} value={settings.pollinationsApiKey} onChange={(event) => setSettings({ ...settings, pollinationsApiKey: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            {settings.pollinationsApiKeyConfigured && <p className="text-sm text-ink/60">An API key is configured.</p>}
          </section>}
          {!messagingPage && canManageModules && <section className="grid gap-3 rounded-2xl border border-coral/25 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">Public website</h2>
            <p className="text-sm text-ink/60">Turn the public-facing church website on or off. When disabled, visitors are sent to the administrator sign-in page and site-building tools are hidden from the admin menu.</p>
            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={settings.publicSiteEnabled} onChange={(event) => setSettings((current) => ({ ...current, publicSiteEnabled: event.target.checked }))} /> Enable public website</label>
          </section>}
          {!messagingPage && canManageModules && <section className="grid gap-3 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl">Available modules</h2>
            <p className="text-sm text-ink/60">Enabled modules appear in the admin menu for users who have the module&apos;s management permission.</p>
            {MODULES.map((module) => <label key={module.slug} className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={settings.enabledModules.includes(module.slug)} onChange={(event) => setSettings((current) => ({ ...current, enabledModules: event.target.checked ? [...current.enabledModules, module.slug] : current.enabledModules.filter((slug) => slug !== module.slug) }))} /> {module.name}</label>)}
          </section>}
          <div><Button type="submit">Save settings</Button>{message && <Notification variant={messageVariant} className="mt-3">{message}</Notification>}</div>
        </form>
      </Container>
    </main>
  );
}
