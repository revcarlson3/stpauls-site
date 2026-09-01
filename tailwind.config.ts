import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17324d",
        coral: "#e66f51",
        sand: "#f8f4ee",
        mist: "#e6eef2"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};

export default config;

