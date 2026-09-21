type AdminNavIconName = "dashboard" | "pages" | "media" | "security" | "users" | "navigation" | "theme" | "settings" | "membership" | "events" | "accounting" | "giving" | "services" | "site";

const paths: Record<AdminNavIconName, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  pages: "M5 3h14v18H5zM8 7h8M8 11h8M8 15h5",
  media: "M4 5h16v14H4zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 16l4-4 3 3 2-2 7 6",
  security: "M12 3l8 4v5c0 4.8-3.4 8.8-8 10-4.6-1.2-8-5.2-8-10V7l8-4zM9.5 12l1.7 1.7 3.8-3.8",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  navigation: "M4 5h16M4 12h16M4 19h16",
  theme: "M12 3a9 9 0 1 0 9 9h-9V3zM12 3a9 9 0 0 1 9 9h-9V3z",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.4A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1H15V5a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.6H21a1.7 1.7 0 0 0-1.6 1.4z",
  membership: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 3.1a4 4 0 0 1 3 6.9M19 14h3M20.5 12.5v3",
  events: "M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2zM7 13h3M14 13h3M7 17h3",
  accounting: "M4 4h16v16H4zM8 16v-4M12 16V8M16 16v-6",
  giving: "M4 6h16v12H4zM8 10h3M8 14h8M16 10h1",
  services: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2V4zM5 4a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h14M8 8h7M8 12h7M8 16h5",
  site: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"
};

export function AdminNavIcon({ name }: { name: AdminNavIconName }) {
  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
