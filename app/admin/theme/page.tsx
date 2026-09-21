"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Container, Notification } from "@/components/ui";
import { THEME_BUTTONS, THEME_ELEVATIONS, THEME_NAVS, THEME_OPTIONS, THEME_RADII, THEME_SPACING, contrastTextColor, googleFontStylesheet, isHexColor, themeComponentColorCssVars, themeCssVars, themeFontCssVars, themeStyleCssVars, type ThemeButton, type ThemeElevation, type ThemeFamily, type ThemeNav, type ThemeRadius, type ThemeSpacing, type ThemeWidth } from "@/lib/theme";

type ThemeSettings = {
  themeFamily: ThemeFamily;
  themeWidth: ThemeWidth;
  themeBackground: string;
  themeForeground: string;
  themeAccent: string;
  themeSurface: string;
  themeButtonPrimary: string;
  themeButtonSecondary: string;
  themeButtonDefault: string;
  themeNotificationPrimary: string;
  themeNotificationSecondary: string;
  themeNotificationDefault: string;
  themeNotificationSuccess: string;
  themeNotificationWarning: string;
  themeNotificationDanger: string;
  themeNotificationInfo: string;
  themeHeadingFont: string;
  themeBodyFont: string;
  themeRadius: ThemeRadius;
  themeElevation: ThemeElevation;
  themeButton: ThemeButton;
  themeNav: ThemeNav;
  themeSpacing: ThemeSpacing;
  themeContentBorder: boolean;
  [key: string]: unknown;
};

const COLOR_FIELDS = [
  ["themeBackground", "Page background"],
  ["themeForeground", "Text and ink"],
  ["themeAccent", "Primary accent"],
  ["themeSurface", "Cards and surfaces"]
] as const;

const BUTTON_COLOR_FIELDS = [
  ["themeButtonPrimary", "Primary"],
  ["themeButtonSecondary", "Secondary"],
  ["themeButtonDefault", "Default"]
] as const;

const NOTIFICATION_COLOR_FIELDS = [
  ["themeNotificationPrimary", "Primary"],
  ["themeNotificationSecondary", "Secondary"],
  ["themeNotificationDefault", "Default"],
  ["themeNotificationSuccess", "Success"],
  ["themeNotificationWarning", "Warning"],
  ["themeNotificationDanger", "Danger"],
  ["themeNotificationInfo", "Info"]
] as const;

const NOTIFICATION_PREVIEW_FIELDS = {
  primary: "themeNotificationPrimary",
  secondary: "themeNotificationSecondary",
  default: "themeNotificationDefault",
  success: "themeNotificationSuccess",
  warning: "themeNotificationWarning",
  danger: "themeNotificationDanger",
  info: "themeNotificationInfo"
} as const;

const PALETTES = [
  { name: "Current", background: "#f8f4ee", foreground: "#17324d", accent: "#e66f51", surface: "#ffffff" },
  { name: "Harbor", background: "#eef4f7", foreground: "#15324a", accent: "#287c8c", surface: "#ffffff" },
  { name: "Meadow", background: "#f1f5ed", foreground: "#253d2d", accent: "#668c5a", surface: "#ffffff" },
  { name: "Sunset", background: "#fff4e8", foreground: "#4a2a25", accent: "#c85c3f", surface: "#ffffff" },
  { name: "Plum", background: "#f5f0f6", foreground: "#392b45", accent: "#89558f", surface: "#ffffff" },
  { name: "Cobalt", background: "#edf3ff", foreground: "#102a56", accent: "#1769d2", surface: "#ffffff" },
  { name: "Walnut", background: "#f7f0e8", foreground: "#3d2b20", accent: "#96613f", surface: "#fffdf9" },
  { name: "Indigo", background: "#f0effb", foreground: "#27234c", accent: "#5a51b5", surface: "#ffffff" },
  { name: "Blue spruce", background: "#edf6f5", foreground: "#173a3d", accent: "#247b80", surface: "#ffffff" }
] as const;

const FONT_PRESETS = [
  { name: "Warm welcome", heading: "Lora", body: "Inter" },
  { name: "Classic bulletin", heading: "Playfair Display", body: "Source Sans 3" },
  { name: "Open invitation", heading: "Merriweather", body: "Nunito Sans" },
  { name: "Modern gathering", heading: "DM Serif Display", body: "DM Sans" },
  { name: "Quiet editorial", heading: "Cormorant Garamond", body: "Manrope" },
  { name: "Clean civic", heading: "Plus Jakarta Sans", body: "Inter" },
  { name: "Contemporary", heading: "Outfit", body: "DM Sans" },
  { name: "Friendly modern", heading: "Nunito Sans", body: "Manrope" },
  { name: "Direct and clear", heading: "Space Grotesk", body: "Source Sans 3" }
] as const;

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);

  useEffect(() => setHex(value), [value]);

  function updateHex(nextValue: string) {
    setHex(nextValue);
    if (isHexColor(nextValue)) onChange(nextValue);
  }

  return (
    <div className="relative flex items-center gap-3 text-sm font-semibold">
      <button type="button" aria-label={`Edit ${label}`} aria-expanded={open} onClick={() => setOpen((current) => !current)} className="focus-ring h-10 w-14 rounded-lg border border-ink/15 p-1">
        <span className="block h-full w-full rounded-md" style={{ backgroundColor: value }} />
      </button>
      <span>{label}<span className="mt-1 block font-mono text-xs font-normal uppercase text-ink/50">{value}</span></span>
      {open && (
        <div className="absolute left-0 top-12 z-20 grid w-64 gap-3 rounded-xl border border-ink/15 bg-surface p-4 shadow-xl">
          <label className="grid gap-1 text-xs font-semibold">
            Color picker
            <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full cursor-pointer rounded-lg border border-ink/15 bg-transparent p-1" />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            HEX value
            <input value={hex} onChange={(event) => updateHex(event.target.value)} onBlur={() => setHex(value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-mono text-xs uppercase" />
          </label>
          <button type="button" onClick={() => setOpen(false)} className="focus-ring w-fit rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold">Done</button>
        </div>
      )}
    </div>
  );
}

function FontSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Array<{ family: string; category: string; subsets: string[]; axes: string[]; tags: string[] }>>([]);
  const [error, setError] = useState("");

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    if (query.trim().length < 2 || query.trim() === value.trim()) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/fonts?q=${encodeURIComponent(query.trim())}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Unable to search Google Fonts.");
          const payload = await response.json();
          setResults(payload.fonts ?? []);
          setError("");
        })
        .catch((reason: Error) => setError(reason.message));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  return (
    <div className="relative">
      <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { event.preventDefault(); onChange(results[0].family); setQuery(results[0].family); setResults([]); } }} className="focus-ring w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="Search family, style, or tag" />
      {error && <p className="mt-1 text-xs font-normal text-red-700">{error}</p>}
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-ink/15 bg-surface p-1 shadow-xl">
          {results.map((font) => (
            <button type="button" key={font.family} onClick={() => { onChange(font.family); setQuery(font.family); setResults([]); }} className="focus-ring block w-full rounded-lg px-3 py-2 text-left hover:bg-sand">
              <span className="block font-semibold" style={{ fontFamily: `"${font.family}", sans-serif` }}>{font.family}</span>
              <span className="block text-xs font-normal text-ink/55">{font.category}{font.tags.length > 0 ? ` · ${font.tags.slice(0, 2).join(", ")}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ThemePage() {
  const [settings, setSettings] = useState<ThemeSettings>({ themeFamily: "bootstrap", themeWidth: "full", themeBackground: "#f8f4ee", themeForeground: "#17324d", themeAccent: "#e66f51", themeSurface: "#ffffff", themeButtonPrimary: "#e66f51", themeButtonSecondary: "#17324d", themeButtonDefault: "#ffffff", themeNotificationPrimary: "#e66f51", themeNotificationSecondary: "#17324d", themeNotificationDefault: "#ffffff", themeNotificationSuccess: "#2f855a", themeNotificationWarning: "#b7791f", themeNotificationDanger: "#c53030", themeNotificationInfo: "#287c8c", themeHeadingFont: "Lora", themeBodyFont: "Inter", themeRadius: "balanced", themeElevation: "soft", themeButton: "pill", themeNav: "minimal", themeSpacing: "comfortable", themeContentBorder: true });
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger">("success");
  const [loaded, setLoaded] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const savedTheme = useRef({ family: "bootstrap", width: "full", background: "#f8f4ee", foreground: "#17324d", accent: "#e66f51", surface: "#ffffff", buttonPrimary: "#e66f51", buttonSecondary: "#17324d", buttonDefault: "#ffffff", notificationPrimary: "#e66f51", notificationSecondary: "#17324d", notificationDefault: "#ffffff", notificationSuccess: "#2f855a", notificationWarning: "#b7791f", notificationDanger: "#c53030", notificationInfo: "#287c8c", headingFont: "Lora", bodyFont: "Inter", radius: "balanced" as ThemeRadius, elevation: "soft" as ThemeElevation, button: "pill" as ThemeButton, nav: "minimal" as ThemeNav, spacing: "comfortable" as ThemeSpacing });
  const selected = THEME_OPTIONS.find((option) => option.family === settings.themeFamily && option.width === settings.themeWidth) ?? THEME_OPTIONS[0];

  function applyPreview(theme: typeof savedTheme.current) {
    const vars = themeCssVars({ background: theme.background, foreground: theme.foreground, accent: theme.accent, surface: theme.surface });
    Object.entries(vars).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
      document.body.style.setProperty(property, value);
    });
    const componentColorVars = themeComponentColorCssVars({ buttonPrimary: theme.buttonPrimary, buttonSecondary: theme.buttonSecondary, buttonDefault: theme.buttonDefault, notificationPrimary: theme.notificationPrimary, notificationSecondary: theme.notificationSecondary, notificationDefault: theme.notificationDefault, notificationSuccess: theme.notificationSuccess, notificationWarning: theme.notificationWarning, notificationDanger: theme.notificationDanger, notificationInfo: theme.notificationInfo });
    Object.entries(componentColorVars).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
      document.body.style.setProperty(property, value);
    });
    const fontVars = themeFontCssVars({ headingFont: theme.headingFont, bodyFont: theme.bodyFont });
    Object.entries(fontVars).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
      document.body.style.setProperty(property, value);
    });
    const styleVars = themeStyleCssVars({ radius: theme.radius, elevation: theme.elevation, button: theme.button, spacing: theme.spacing });
    Object.entries(styleVars).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
      document.body.style.setProperty(property, value);
    });
    const fontLinkId = "theme-google-fonts";
    let fontLink = document.getElementById(fontLinkId) as HTMLLinkElement | null;
    if (!fontLink) {
      fontLink = document.createElement("link");
      fontLink.id = fontLinkId;
      fontLink.rel = "stylesheet";
      document.head.appendChild(fontLink);
    }
    fontLink.href = googleFontStylesheet([theme.headingFont, theme.bodyFont]);
  }

  useEffect(() => {
    void fetch("/api/site-settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load theme settings.");
        const value = await response.json();
        savedTheme.current = { family: value.themeFamily ?? "bootstrap", width: value.themeWidth ?? "full", background: value.themeBackground ?? "#f8f4ee", foreground: value.themeForeground ?? "#17324d", accent: value.themeAccent ?? "#e66f51", surface: value.themeSurface ?? "#ffffff", buttonPrimary: value.themeButtonPrimary ?? "#e66f51", buttonSecondary: value.themeButtonSecondary ?? "#17324d", buttonDefault: value.themeButtonDefault ?? "#ffffff", notificationPrimary: value.themeNotificationPrimary ?? "#e66f51", notificationSecondary: value.themeNotificationSecondary ?? "#17324d", notificationDefault: value.themeNotificationDefault ?? "#ffffff", notificationSuccess: value.themeNotificationSuccess ?? "#2f855a", notificationWarning: value.themeNotificationWarning ?? "#b7791f", notificationDanger: value.themeNotificationDanger ?? "#c53030", notificationInfo: value.themeNotificationInfo ?? "#287c8c", headingFont: value.themeHeadingFont ?? "Lora", bodyFont: value.themeBodyFont ?? "Inter", radius: value.themeRadius ?? "balanced", elevation: value.themeElevation ?? "soft", button: value.themeButton ?? "pill", nav: value.themeNav ?? "minimal", spacing: value.themeSpacing ?? "comfortable" };
        setSettings((current) => ({ ...current, ...value, smtpPassword: "", emailApiKey: "", emailApiSecret: "", smsAuthSecret: "", registrationCode: "" }));
        setLoaded(true);
      })
      .catch((error: Error) => { setMessageVariant("danger"); setMessage(error.message); });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.body.dataset.themeFamily = settings.themeFamily;
    document.body.dataset.themeWidth = settings.themeWidth;
    document.body.dataset.themeRadius = settings.themeRadius;
    document.body.dataset.themeElevation = settings.themeElevation;
    document.body.dataset.themeButton = settings.themeButton;
    document.body.dataset.themeNav = settings.themeNav;
    document.body.dataset.themeSpacing = settings.themeSpacing;
    document.body.dataset.themeContentBorder = settings.themeContentBorder ? "visible" : "hidden";
    applyPreview({ family: settings.themeFamily, width: settings.themeWidth, background: settings.themeBackground, foreground: settings.themeForeground, accent: settings.themeAccent, surface: settings.themeSurface, buttonPrimary: settings.themeButtonPrimary, buttonSecondary: settings.themeButtonSecondary, buttonDefault: settings.themeButtonDefault, notificationPrimary: settings.themeNotificationPrimary, notificationSecondary: settings.themeNotificationSecondary, notificationDefault: settings.themeNotificationDefault, notificationSuccess: settings.themeNotificationSuccess, notificationWarning: settings.themeNotificationWarning, notificationDanger: settings.themeNotificationDanger, notificationInfo: settings.themeNotificationInfo, headingFont: settings.themeHeadingFont, bodyFont: settings.themeBodyFont, radius: settings.themeRadius, elevation: settings.themeElevation, button: settings.themeButton, nav: settings.themeNav, spacing: settings.themeSpacing });
    setPreviewVersion((current) => current + 1);
    return () => {
      document.body.dataset.themeFamily = savedTheme.current.family;
      document.body.dataset.themeWidth = savedTheme.current.width;
      document.body.dataset.themeRadius = savedTheme.current.radius;
      document.body.dataset.themeElevation = savedTheme.current.elevation;
      document.body.dataset.themeButton = savedTheme.current.button;
      document.body.dataset.themeNav = savedTheme.current.nav;
      document.body.dataset.themeSpacing = savedTheme.current.spacing;
      document.body.dataset.themeContentBorder = "visible";
      applyPreview(savedTheme.current);
    };
  }, [loaded, settings.themeFamily, settings.themeWidth, settings.themeBackground, settings.themeForeground, settings.themeAccent, settings.themeSurface, settings.themeButtonPrimary, settings.themeButtonSecondary, settings.themeButtonDefault, settings.themeNotificationPrimary, settings.themeNotificationSecondary, settings.themeNotificationDefault, settings.themeNotificationSuccess, settings.themeNotificationWarning, settings.themeNotificationDanger, settings.themeNotificationInfo, settings.themeHeadingFont, settings.themeBodyFont, settings.themeRadius, settings.themeElevation, settings.themeButton, settings.themeNav, settings.themeSpacing, settings.themeContentBorder]);

  async function save() {
    setMessage("");
    const response = await fetch("/api/site-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Theme saved." : "Unable to save theme.");
    if (response.ok) {
      savedTheme.current = { family: settings.themeFamily, width: settings.themeWidth, background: settings.themeBackground, foreground: settings.themeForeground, accent: settings.themeAccent, surface: settings.themeSurface, buttonPrimary: settings.themeButtonPrimary, buttonSecondary: settings.themeButtonSecondary, buttonDefault: settings.themeButtonDefault, notificationPrimary: settings.themeNotificationPrimary, notificationSecondary: settings.themeNotificationSecondary, notificationDefault: settings.themeNotificationDefault, notificationSuccess: settings.themeNotificationSuccess, notificationWarning: settings.themeNotificationWarning, notificationDanger: settings.themeNotificationDanger, notificationInfo: settings.themeNotificationInfo, headingFont: settings.themeHeadingFont, bodyFont: settings.themeBodyFont, radius: settings.themeRadius, elevation: settings.themeElevation, button: settings.themeButton, nav: settings.themeNav, spacing: settings.themeSpacing };
      window.dispatchEvent(new Event("site-settings-updated"));
    }
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p>
        <h1 className="mt-2 font-serif text-4xl">Site theme</h1>
        <p className="mt-3 max-w-2xl text-ink/60">Choose the visual foundation for the public website and its connected administration tools. Your logo, favicon, and identity assets remain unchanged.</p>
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <h2 className="font-serif text-2xl">Theme selection</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">Choose the visual foundation first. The controls beside it refine the selected theme.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {THEME_OPTIONS.map((option) => {
            const active = option.family === settings.themeFamily && option.width === settings.themeWidth;
            return (
              <button
                type="button"
                key={`${option.family}-${option.width}`}
                onClick={() => setSettings((current) => ({ ...current, themeFamily: option.family, themeWidth: option.width }))}
                className={`focus-ring rounded-2xl border p-5 text-left transition ${active ? "border-coral bg-sand shadow-md" : "border-ink/10 bg-white hover:border-coral/50 hover:shadow-sm"}`}
                aria-pressed={active}
              >
                <span className={`mb-5 block h-24 rounded-xl ${option.family === "bootstrap" ? "bg-ink" : option.family === "tailwind" ? "bg-coral" : "bg-mist"}`}>
                  <span className={`block h-full w-2/3 ${option.width === "full" ? "rounded-xl bg-white/25" : "mx-auto rounded-xl bg-white/70"}`} />
                </span>
                <span className="block font-semibold">{option.name}</span>
                <span className="mt-2 block text-sm leading-6 text-ink/60">{option.description}</span>
              </button>
            );
          })}
          </div>
          </section>
          <div className="grid gap-6">
        <details className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <summary className="cursor-pointer list-none font-serif text-2xl">Core color palette</summary>
          <p className="mt-2 text-sm leading-6 text-ink/60">These roles update the live preview immediately and apply across public and admin surfaces when saved.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map(([key, label]) => (
              <ColorControl key={key} label={label} value={settings[key]} onChange={(value) => setSettings((current) => ({ ...current, [key]: value }))} />
            ))}
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold">Preset palettes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PALETTES.map((palette) => (
                <button type="button" key={palette.name} onClick={() => setSettings((current) => ({ ...current, themeBackground: palette.background, themeForeground: palette.foreground, themeAccent: palette.accent, themeSurface: palette.surface }))} className="focus-ring inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-semibold hover:border-coral">
                  <span className="h-4 w-4 rounded-full border border-ink/15" style={{ background: `linear-gradient(135deg, ${palette.background} 50%, ${palette.accent} 50%)` }} />
                  {palette.name}
                </button>
              ))}
            </div>
          </div>
        </details>
        <details className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <summary className="cursor-pointer list-none font-serif text-2xl">Typography</summary>
          <p className="mt-2 text-sm leading-6 text-ink/60">Choose a heading and body family from Google Fonts. Changes load into the live preview immediately.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {FONT_PRESETS.map((preset) => (
              <button type="button" key={preset.name} onClick={() => setSettings((current) => ({ ...current, themeHeadingFont: preset.heading, themeBodyFont: preset.body }))} className="focus-ring rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-semibold hover:border-coral">{preset.name}<span className="ml-2 font-normal text-ink/50">{preset.heading} + {preset.body}</span></button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(["themeHeadingFont", "themeBodyFont"] as const).map((key) => (
              <label key={key} className="grid gap-1 text-sm font-semibold">
                {key === "themeHeadingFont" ? "Heading font" : "Body font"}
                <FontSearch value={settings[key]} onChange={(value) => setSettings((current) => ({ ...current, [key]: value }))} />
              </label>
            ))}
          </div>
        </details>
        <details className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <summary className="cursor-pointer list-none font-serif text-2xl">Component style</summary>
          <p className="mt-2 text-sm leading-6 text-ink/60">Set the shared shape, depth, navigation, and spacing language.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {([
              ["themeRadius", "Corner radius", THEME_RADII, ["Compact", "Balanced", "Soft"]],
              ["themeElevation", "Elevation", THEME_ELEVATIONS, ["Flat", "Soft", "Lifted"]],
              ["themeButton", "Button shape", THEME_BUTTONS, ["Pill", "Rounded", "Square"]],
              ["themeNav", "Navigation treatment", THEME_NAVS, ["Minimal", "Lined", "Solid"]],
              ["themeSpacing", "Spacing density", THEME_SPACING, ["Compact", "Comfortable", "Airy"]]
            ] as const).map(([key, label, values, names]) => (
              <label key={key} className="grid gap-1 text-sm font-semibold">
                {label}
                <select value={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} className="focus-ring rounded-lg border border-ink/15 bg-surface px-3 py-2 font-normal">
                  {values.map((value, index) => <option key={value} value={value}>{names[index]}</option>)}
                </select>
              </label>
            ))}
          </div>
          <label className="mt-5 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={settings.themeContentBorder} onChange={(event) => setSettings((current) => ({ ...current, themeContentBorder: event.target.checked }))} className="mt-1 h-4 w-4 accent-coral" />
            <span><strong className="block">Show contained content border</strong><span className="text-ink/60">Wrap the contained header and page content in the theme surface border.</span></span>
          </label>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
             <p className="text-sm font-semibold">Button colors</p>
             <div className="mt-3 grid gap-3">
               {BUTTON_COLOR_FIELDS.map(([key, label]) => <ColorControl key={key} label={label} value={settings[key]} onChange={(value) => setSettings((current) => ({ ...current, [key]: value }))} />)}
             </div>
            </div>
            <div>
             <p className="text-sm font-semibold">Notification colors</p>
             <div className="mt-3 grid gap-3">
               {NOTIFICATION_COLOR_FIELDS.map(([key, label]) => <ColorControl key={key} label={label} value={settings[key]} onChange={(value) => setSettings((current) => ({ ...current, [key]: value }))} />)}
             </div>
            </div>
          </div>
          <div key={previewVersion} className="theme-preview-stage mt-6 rounded-[var(--site-radius-card)] border border-ink/10 bg-sand/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Preview</p>
            <nav className={`mt-3 flex items-center gap-4 px-3 py-2 text-sm font-semibold ${settings.themeNav === "solid" ? "rounded-[var(--site-radius-control)] bg-ink text-white" : settings.themeNav === "lined" ? "border-b-2 border-coral" : "border-b border-ink/15"}`} aria-label="Component style preview">
              <span>Home</span><span>Visit</span><span>Connect</span>
            </nav>
            <div className={`mt-4 grid ${settings.themeSpacing === "compact" ? "gap-2" : settings.themeSpacing === "airy" ? "gap-6" : "gap-4"} sm:grid-cols-[1fr_auto] sm:items-center`}>
              <div className="rounded-[var(--site-radius-card)] border border-ink/10 bg-surface p-4 shadow-[var(--site-shadow-card)]">
                <p className="font-serif text-lg">A place to belong</p>
                <p className="mt-1 text-sm text-ink/60">A sample surface using the selected style.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-[var(--site-radius-control)] bg-[rgb(var(--site-button-primary))] px-3 py-2 text-xs font-semibold text-[rgb(var(--site-button-primary-text))] shadow-[var(--site-shadow-card)]">Primary</button>
                <button type="button" className="rounded-[var(--site-radius-control)] bg-[rgb(var(--site-button-secondary))] px-3 py-2 text-xs font-semibold text-[rgb(var(--site-button-secondary-text))]">Secondary</button>
                <button type="button" className="rounded-[var(--site-radius-control)] border border-ink/20 bg-[rgb(var(--site-button-default))] px-3 py-2 text-xs font-semibold">Default</button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(["primary", "secondary", "default", "success", "warning", "danger", "info"] as const).map((kind) => {
                const color = settings[NOTIFICATION_PREVIEW_FIELDS[kind]];
                return <div key={kind} className="rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold" style={{ backgroundColor: color, color: contrastTextColor(color) }}>{kind[0].toUpperCase() + kind.slice(1)} notification</div>;
              })}
            </div>
          </div>
        </details>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <Button type="button" onClick={() => void save()}>Save theme</Button>
          <p className="text-sm text-ink/60">Selected: {selected.name}</p>
          {message && <Notification variant={messageVariant}>{message}</Notification>}
        </div>
      </Container>
    </main>
  );
}
