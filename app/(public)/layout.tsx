import { getCurrentUser } from "@/lib/auth";
import { AdminDrawer } from "@/components/admin-drawer";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSiteTheme } from "@/lib/theme";

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const theme = await getSiteTheme();
  const integrated = theme.family === "bootstrap";
  return (
    <div className="min-h-screen">
      {user?.canAccessAdmin && <AdminDrawer />}
      {integrated ? <main className="site-public-frame site-public-frame-integrated site-section"><SiteHeader />{children}<SiteFooter /></main> : <>
        <SiteHeader />
        <main className="site-public-content site-section">{children}</main>
        <SiteFooter />
      </>}
    </div>
  );
}
