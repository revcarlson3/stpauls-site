import { db } from "@/lib/db";

export const THEME_FAMILIES = ["bootstrap", "tailwind", "material"] as const;
export const THEME_WIDTHS = ["full", "contained"] as const;
export const THEME_RADII = ["compact", "balanced", "soft"] as const;
export const THEME_ELEVATIONS = ["flat", "soft", "lifted"] as const;
export const THEME_BUTTONS = ["pill", "rounded", "square"] as const;
export const THEME_NAVS = ["minimal", "lined", "solid"] as const;
export const THEME_SPACING = ["compact", "comfortable", "airy"] as const;

export type ThemeFamily = (typeof THEME_FAMILIES)[number];
export type ThemeWidth = (typeof THEME_WIDTHS)[number];
export type ThemeRadius = (typeof THEME_RADII)[number];
export type ThemeElevation = (typeof THEME_ELEVATIONS)[number];
export type ThemeButton = (typeof THEME_BUTTONS)[number];
export type ThemeNav = (typeof THEME_NAVS)[number];
export type ThemeSpacing = (typeof THEME_SPACING)[number];

export const THEME_OPTIONS: Array<{
  family: ThemeFamily;
  width: ThemeWidth;
  name: string;
  description: string;
}> = [
  { family: "bootstrap", width: "full", name: "Bootstrap · Full width", description: "Familiar, practical, and spacious across the viewport." },
  { family: "bootstrap", width: "contained", name: "Bootstrap · Contained", description: "A focused reading column with adjustable page margins." },
  { family: "tailwind", width: "full", name: "Tailwind · Full width", description: "Editorial breathing room with flexible section layouts." },
  { family: "tailwind", width: "contained", name: "Tailwind · Contained", description: "A compact, crafted canvas for focused content." },
  { family: "material", width: "full", name: "Material · Full width", description: "Structured surfaces and clear visual hierarchy." },
  { family: "material", width: "contained", name: "Material · Contained", description: "A grounded, application-like content frame." }
];

export const DEFAULT_THEME = {
  family: "bootstrap" as ThemeFamily,
  width: "full" as ThemeWidth,
  background: "#f8f4ee",
  foreground: "#17324d",
  accent: "#e66f51",
  surface: "#ffffff",
  buttonPrimary: "#e66f51",
  buttonSecondary: "#17324d",
  buttonDefault: "#ffffff",
  notificationPrimary: "#e66f51",
  notificationSecondary: "#17324d",
  notificationDefault: "#ffffff",
  notificationSuccess: "#2f855a",
  notificationWarning: "#b7791f",
  notificationDanger: "#c53030",
  notificationInfo: "#287c8c",
  headingFont: "Lora",
  bodyFont: "Inter",
  radius: "balanced" as ThemeRadius,
  elevation: "soft" as ThemeElevation,
  button: "pill" as ThemeButton,
  nav: "minimal" as ThemeNav,
  spacing: "comfortable" as ThemeSpacing
};

export type ThemeColors = Pick<typeof DEFAULT_THEME, "background" | "foreground" | "accent" | "surface">;

export function isThemeFamily(value: unknown): value is ThemeFamily {
  return typeof value === "string" && THEME_FAMILIES.includes(value as ThemeFamily);
}

export function isThemeWidth(value: unknown): value is ThemeWidth {
  return typeof value === "string" && THEME_WIDTHS.includes(value as ThemeWidth);
}

export function isThemeStyle(value: unknown, values: readonly string[]): value is string {
  return typeof value === "string" && values.includes(value);
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function hexToRgb(value: string) {
  const normalized = value.replace("#", "");
  return `${Number.parseInt(normalized.slice(0, 2), 16)} ${Number.parseInt(normalized.slice(2, 4), 16)} ${Number.parseInt(normalized.slice(4, 6), 16)}`;
}

export function themeCssVars(theme: ThemeColors) {
  return {
    "--color-sand": hexToRgb(theme.background),
    "--color-ink": hexToRgb(theme.foreground),
    "--color-coral": hexToRgb(theme.accent),
    "--color-surface": hexToRgb(theme.surface)
  };
}

export function themeComponentColorCssVars(theme: {
  buttonPrimary: string;
  buttonSecondary: string;
  buttonDefault: string;
  notificationPrimary: string;
  notificationSecondary: string;
  notificationDefault: string;
  notificationSuccess: string;
  notificationWarning: string;
  notificationDanger: string;
  notificationInfo: string;
}) {
  return {
    "--site-button-primary": hexToRgb(theme.buttonPrimary),
    "--site-button-secondary": hexToRgb(theme.buttonSecondary),
    "--site-button-default": hexToRgb(theme.buttonDefault),
    "--site-notification-primary": hexToRgb(theme.notificationPrimary),
    "--site-notification-secondary": hexToRgb(theme.notificationSecondary),
    "--site-notification-default": hexToRgb(theme.notificationDefault),
    "--site-notification-success": hexToRgb(theme.notificationSuccess),
    "--site-notification-warning": hexToRgb(theme.notificationWarning),
    "--site-notification-danger": hexToRgb(theme.notificationDanger),
    "--site-notification-info": hexToRgb(theme.notificationInfo)
  };
}

export function themeFontCssVars(theme: { headingFont: string; bodyFont: string }) {
  return {
    "--font-heading": `"${theme.headingFont}", Georgia, serif`,
    "--font-body": `"${theme.bodyFont}", Arial, sans-serif`
  };
}

export function themeStyleCssVars(theme: { radius: ThemeRadius; elevation: ThemeElevation; button: ThemeButton; spacing: ThemeSpacing }) {
  return {
    "--site-radius-card": theme.radius === "compact" ? "0.75rem" : theme.radius === "soft" ? "1.5rem" : "1rem",
    "--site-radius-control": theme.button === "pill" ? "999px" : theme.button === "square" ? "0.35rem" : "0.75rem",
    "--site-shadow-card": theme.elevation === "flat" ? "none" : theme.elevation === "lifted" ? "0 12px 28px rgb(var(--color-ink) / 0.14)" : "0 2px 8px rgb(var(--color-ink) / 0.08)",
    "--site-section-space": theme.spacing === "compact" ? "3rem" : theme.spacing === "airy" ? "7rem" : "5rem",
    "--site-header-padding": theme.spacing === "compact" ? "0.75rem" : theme.spacing === "airy" ? "1.5rem" : "1rem",
    "--site-card-padding": theme.spacing === "compact" ? "1.25rem" : theme.spacing === "airy" ? "2rem" : "1.5rem",
    "--site-block-gap": theme.spacing === "compact" ? "1rem" : theme.spacing === "airy" ? "2.5rem" : "1.5rem"
  };
}

export function googleFontStylesheet(fonts: string[]) {
  const families = fonts.map((font) => `family=${encodeURIComponent(font).replace(/%20/g, "+")}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export async function getSiteTheme() {
  const settings = await db.securitySettings.findUnique({
    where: { id: 1 },
    select: { themeFamily: true, themeWidth: true, themeBackground: true, themeForeground: true, themeAccent: true, themeSurface: true, themeButtonPrimary: true, themeButtonSecondary: true, themeButtonDefault: true, themeNotificationPrimary: true, themeNotificationSecondary: true, themeNotificationDefault: true, themeNotificationSuccess: true, themeNotificationWarning: true, themeNotificationDanger: true, themeNotificationInfo: true, themeHeadingFont: true, themeBodyFont: true, themeRadius: true, themeElevation: true, themeButton: true, themeNav: true, themeSpacing: true, themeContentBorder: true }
  });

  return {
    family: isThemeFamily(settings?.themeFamily) ? settings.themeFamily : DEFAULT_THEME.family,
    width: isThemeWidth(settings?.themeWidth) ? settings.themeWidth : DEFAULT_THEME.width,
    background: isHexColor(settings?.themeBackground) ? settings.themeBackground : DEFAULT_THEME.background,
    foreground: isHexColor(settings?.themeForeground) ? settings.themeForeground : DEFAULT_THEME.foreground,
    accent: isHexColor(settings?.themeAccent) ? settings.themeAccent : DEFAULT_THEME.accent,
    surface: isHexColor(settings?.themeSurface) ? settings.themeSurface : DEFAULT_THEME.surface,
    buttonPrimary: isHexColor(settings?.themeButtonPrimary) ? settings.themeButtonPrimary : DEFAULT_THEME.buttonPrimary,
    buttonSecondary: isHexColor(settings?.themeButtonSecondary) ? settings.themeButtonSecondary : DEFAULT_THEME.buttonSecondary,
    buttonDefault: isHexColor(settings?.themeButtonDefault) ? settings.themeButtonDefault : DEFAULT_THEME.buttonDefault,
    notificationPrimary: isHexColor(settings?.themeNotificationPrimary) ? settings.themeNotificationPrimary : DEFAULT_THEME.notificationPrimary,
    notificationSecondary: isHexColor(settings?.themeNotificationSecondary) ? settings.themeNotificationSecondary : DEFAULT_THEME.notificationSecondary,
    notificationDefault: isHexColor(settings?.themeNotificationDefault) ? settings.themeNotificationDefault : DEFAULT_THEME.notificationDefault,
    notificationSuccess: isHexColor(settings?.themeNotificationSuccess) ? settings.themeNotificationSuccess : DEFAULT_THEME.notificationSuccess,
    notificationWarning: isHexColor(settings?.themeNotificationWarning) ? settings.themeNotificationWarning : DEFAULT_THEME.notificationWarning,
    notificationDanger: isHexColor(settings?.themeNotificationDanger) ? settings.themeNotificationDanger : DEFAULT_THEME.notificationDanger,
    notificationInfo: isHexColor(settings?.themeNotificationInfo) ? settings.themeNotificationInfo : DEFAULT_THEME.notificationInfo,
    headingFont: settings?.themeHeadingFont?.trim() || DEFAULT_THEME.headingFont,
    bodyFont: settings?.themeBodyFont?.trim() || DEFAULT_THEME.bodyFont,
    radius: isThemeStyle(settings?.themeRadius, THEME_RADII) ? settings.themeRadius as ThemeRadius : DEFAULT_THEME.radius,
    elevation: isThemeStyle(settings?.themeElevation, THEME_ELEVATIONS) ? settings.themeElevation as ThemeElevation : DEFAULT_THEME.elevation,
    button: isThemeStyle(settings?.themeButton, THEME_BUTTONS) ? settings.themeButton as ThemeButton : DEFAULT_THEME.button,
    nav: isThemeStyle(settings?.themeNav, THEME_NAVS) ? settings.themeNav as ThemeNav : DEFAULT_THEME.nav,
    spacing: isThemeStyle(settings?.themeSpacing, THEME_SPACING) ? settings.themeSpacing as ThemeSpacing : DEFAULT_THEME.spacing,
    contentBorder: settings?.themeContentBorder !== false
  };
}
