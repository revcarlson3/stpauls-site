import Link from "next/link";
import type { CSSProperties } from "react";
import type { User } from "@/lib/auth";
import { Container } from "@/components/ui";
import { AuthenticatedPublicNav, ResponsivePublicNav } from "@/components/responsive-public-nav";
import { resolvePublicMenu } from "@/lib/content";
import type { getSiteIdentity } from "@/lib/site-identity";
import type { getSiteTheme } from "@/lib/theme";
import type { getSiteLayout } from "@/lib/site-layout";
import { SiteHeaderFrame } from "@/components/site-header-frame";
import { MenuLinks } from "@/components/menu-links";
import { sanitizeRichTextHtml } from "@/lib/safe-html";

type SiteHeaderProps = {
  menuId?: string | null;
  menuLocationId?: string | null;
  user: User | null;
  identity: Awaited<ReturnType<typeof getSiteIdentity>>;
  theme: Awaited<ReturnType<typeof getSiteTheme>>;
  layout: Awaited<ReturnType<typeof getSiteLayout>>;
};

export async function SiteHeader({ menuId = null, menuLocationId = null, user, identity, theme, layout }: SiteHeaderProps) {
  const menu = await resolvePublicMenu(menuId, menuLocationId, "primary");
  const header = layout.header;
  const preHeaderMenu = header.preHeader.enabled && header.preHeader.menuId
    ? await resolvePublicMenu(header.preHeader.menuId, null, "primary")
    : null;
  const mainMenuId = menu?.id ?? null;
  const logoUrl = theme.nav === "solid" ? (identity.logoDarkUrl || identity.logoUrl) : identity.logoUrl;
  const headerHeight = header.height === "compact" ? "4rem" : header.height === "tall" ? "7rem" : "5rem";
  const preHeaderHeight = header.preHeader.height === "compact" ? "2.5rem" : header.preHeader.height === "tall" ? "6rem" : "4rem";
  const preHeaderFontSize = header.preHeader.fontSize === "small" ? "text-sm" : header.preHeader.fontSize === "large" ? "text-lg" : "text-base";
  const preHeaderMenuAlignment = header.preHeader.alignment === "left" ? "justify-start" : header.preHeader.alignment === "center" ? "justify-center" : "justify-end";

  return (
    <SiteHeaderFrame sticky={header.sticky} stylistic={header.stylistic} style={{ backgroundColor: header.background, color: header.textColor }}>
      {header.preHeader.enabled && <div className="site-header-preheader border-b border-current/10" style={{ backgroundColor: header.preHeader.background, "--site-preheader-min-height": preHeaderHeight } as CSSProperties}>
        <Container className={`site-header-preheader-container flex items-center gap-4 px-0 py-2 ${preHeaderFontSize}`}>
          {header.preHeader.html && <div className="rich-text-content site-header-preheader-content min-w-0 flex-1 break-words leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(header.preHeader.html) }} />}
          {preHeaderMenu && <div className={`hidden min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 lg:flex ${preHeaderMenuAlignment}`}><MenuLinks items={preHeaderMenu.items} className="flex flex-wrap items-center gap-x-4 gap-y-1" /><AuthenticatedPublicNav authenticated={Boolean(user)} menuId={preHeaderMenu.id} isMainNavigation={false} accountMenuIds={header.accountMenuIds} membershipMenuIds={header.membershipMenuIds} logoutMenuIds={header.logoutMenuIds} notificationMenuIds={header.notificationMenuIds} compact /></div>}
        </Container>
      </div>}
      <div className={`site-header-primary border-b border-black/10 ${header.sticky ? "is-sticky sticky top-0 z-40" : ""}`} style={{ backgroundColor: header.background, color: header.textColor }}>
        <Container className="site-header-container site-header-main flex items-center gap-6 px-0" style={{ "--site-header-min-height": headerHeight } as CSSProperties}>
          <div className="site-header-identity flex shrink-0 items-center gap-3">
            {identity.showLogo && logoUrl && <img src={logoUrl} alt="" className="h-10 w-auto object-contain" />}
            {(identity.showTitle || identity.showTagline) && <Link href="/" className="focus-ring">
              {identity.showTitle && <span className="block font-serif text-xl font-bold tracking-tight">{identity.name}</span>}
              {identity.showTagline && <span className="block text-xs text-ink/60">{identity.tagline}</span>}
            </Link>}
          </div>
          <div className="site-header-navigation min-w-0 flex-1">
            <ResponsivePublicNav items={menu?.items ?? []} authenticated={Boolean(user)} menuId={mainMenuId} accountMenuIds={header.accountMenuIds} membershipMenuIds={header.membershipMenuIds} logoutMenuIds={header.logoutMenuIds} notificationMenuIds={header.notificationMenuIds} />
          </div>
        </Container>
      </div>
    </SiteHeaderFrame>
  );
}
