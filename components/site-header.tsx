import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Container } from "@/components/ui";
import { ResponsivePublicNav } from "@/components/responsive-public-nav";
import { resolvePublicMenu } from "@/lib/content";
import { getSiteIdentity } from "@/lib/site-identity";
import { getSiteTheme } from "@/lib/theme";
import { getSiteLayout } from "@/lib/site-layout";

export async function SiteHeader({ menuId = null, menuLocationId = null }: { menuId?: string | null; menuLocationId?: string | null }) {
  const user = await getCurrentUser();
  const menu = await resolvePublicMenu(menuId, menuLocationId, "primary");
  const identity = await getSiteIdentity();
  const theme = await getSiteTheme();
  const layout = await getSiteLayout();
  const header = layout.header;
  const logoUrl = theme.nav === "solid" ? (identity.logoDarkUrl || identity.logoUrl) : identity.logoUrl;
  const heightClass = header.height === "compact" ? "min-h-16" : header.height === "tall" ? "min-h-28" : "min-h-20";

  return (
    <header className={`site-header border-b border-black/10 ${header.sticky ? "sticky top-0 z-40" : ""}`} style={{ backgroundColor: header.background, color: header.textColor }}>
      <Container className={`site-header-container px-0 flex ${heightClass} items-center gap-6`}>
        <div className="site-header-identity flex shrink-0 items-center gap-3">
          {identity.showLogo && logoUrl && <img src={logoUrl} alt="" className="h-10 w-auto object-contain" />}
          {(identity.showTitle || identity.showTagline) && <Link href="/" className="focus-ring">
            {identity.showTitle && <span className="block font-serif text-xl font-bold tracking-tight">{identity.name}</span>}
            {identity.showTagline && <span className="block text-xs text-ink/60">{identity.tagline}</span>}
          </Link>}
        </div>
        <div className="site-header-navigation min-w-0 flex-1">
          <ResponsivePublicNav items={menu?.items ?? []} authenticated={Boolean(user)} />
        </div>
      </Container>
    </header>
  );
}
