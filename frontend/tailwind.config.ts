import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages*.{js,ts,jsx,tsx,mdx}",
    "./components*.{js,ts,jsx,tsx,mdx}",
    "./app*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-fixel-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: "#1A69F3",
      }
    },
  },
  plugins: [],
};
export default config;