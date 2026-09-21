import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        coral: "rgb(var(--color-coral) / <alpha-value>)",
        sand: "rgb(var(--color-sand) / <alpha-value>)",
        mist: "rgb(var(--color-mist) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["var(--font-body)", "Arial", "sans-serif"],
        serif: ["var(--font-heading)", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
