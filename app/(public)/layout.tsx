import { getCurrentUser } from "@/lib/auth";
import { AdminDrawer } from "@/components/admin-drawer";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSiteTheme } from "@/lib/theme";
import { isPublicSiteEnabled } from "@/lib/modules";
import { isMaintenanceModeEnabled } from "@/lib/modules";
import { getSiteIdentity } from "@/lib/site-identity";
import { MaintenancePage } from "@/components/maintenance-page";
import AdminLayout from "@/app/admin/layout";
import { AnnouncementTicker } from "@/components/announcement-ticker";

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await isPublicSiteEnabled())) {
    return <AdminLayout>{children}</AdminLayout>;
  }
  const user = await getCurrentUser();
  if (await isMaintenanceModeEnabled() && !user?.canAccessAdmin) {
    const identity = await getSiteIdentity();
    return <MaintenancePage publicSiteName={identity.name} />;
  }
  const theme = await getSiteTheme();
  const integrated = theme.family === "bootstrap";
  return (
    <div className="flex min-h-screen flex-col">
      {user?.canAccessAdmin && <AdminDrawer />}
      <AnnouncementTicker publicOnly />
      {integrated ? <main className="site-public-frame site-public-frame-integrated site-section flex min-h-screen flex-col"><SiteHeader /><div className="flex-1">{children}</div><SiteFooter /></main> : <>
        <SiteHeader />
        <main className="site-public-content site-section flex-1">{children}</main>
        <SiteFooter />
      </>}
    </div>
  );
}
