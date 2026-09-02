import { Container } from "@/components/ui";
import { MenuLocationsManager } from "@/components/menu-locations-manager";

export default function MenuLocationsPage() {
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site structure</p><h1 className="mt-2 font-serif text-4xl">Menu locations</h1><p className="mt-2 text-ink/60">Assign reusable menus to site-wide navigation locations.</p><div className="mt-8"><MenuLocationsManager /></div></Container></main>;
}
