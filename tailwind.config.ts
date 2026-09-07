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
          border: "#2a2a3a",
          muted: "#8b8b9e",
          gold: "#f5c542",
          amber: "#f59e0b",
          blue: "#3b82f6",
          electric: "#38bdf8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
