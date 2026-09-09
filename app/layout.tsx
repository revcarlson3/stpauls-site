import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { getSiteTheme, googleFontStylesheet, themeComponentColorCssVars, themeCssVars, themeFontCssVars, themeStyleCssVars } from "@/lib/theme";
import { getSiteIdentity } from "@/lib/site-identity";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getSiteIdentity();
  const title = identity.showTagline && identity.tagline
    ? `${identity.name} | ${identity.tagline}`
    : identity.name;
  let metadataBase: URL | undefined;
  if (identity.url) {
    try {
      metadataBase = new URL(identity.url);
    } catch {
      metadataBase = undefined;
    }
  }

  return {
    metadataBase,
    title,
    description: identity.tagline,
    icons: identity.faviconUrl ? { icon: identity.faviconUrl, shortcut: identity.faviconUrl } : undefined,
    openGraph: { title, description: identity.tagline, url: identity.url || undefined, siteName: identity.name, type: "website" }
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getSiteTheme();
  const identity = await getSiteIdentity();
  return (
    <html lang="en">
      <head><link rel="stylesheet" href={googleFontStylesheet([theme.headingFont, theme.bodyFont])} />{identity.faviconUrl && <link rel="icon" href={identity.faviconUrl} />}</head>
      <body data-theme-family={theme.family} data-theme-width={theme.width} data-theme-radius={theme.radius} data-theme-elevation={theme.elevation} data-theme-button={theme.button} data-theme-nav={theme.nav} data-theme-spacing={theme.spacing} data-theme-content-border={theme.contentBorder ? "visible" : "hidden"} style={{ ...themeCssVars(theme), ...themeComponentColorCssVars(theme), ...themeFontCssVars(theme), ...themeStyleCssVars(theme) } as React.CSSProperties} className={`${inter.variable} ${lora.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
