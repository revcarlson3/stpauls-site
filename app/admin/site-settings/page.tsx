import { Container } from "@/components/ui";

export default function SiteSettingsPage() {
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p><h1 className="mt-2 font-serif text-4xl">Site Settings</h1><p className="mt-3 max-w-2xl text-ink/60">Site name, public URL, SMTP, and email configuration will be managed here in a future settings module.</p></Container></main>;
}
