import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        newsroom: {
          bg: "#0a0a0f",
          panel: "#12121a",
          card: "#16161f",
          "card-hover": "#1a1a24",
          border: "#2a2a3a",
          "border-strong": "#3a3a4e",
          muted: "#8b8b9e",
          gold: "#f5c542",
          amber: "#f59e0b",
          blue: "#3b82f6",
          electric: "#38bdf8",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        newsroom: "72rem",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
