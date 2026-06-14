import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Reach / Target / Foundation tier colors (user-facing terminology).
        reach: "#7c3aed",
        target: "#2563eb",
        foundation: "#059669",
        brand: {
          DEFAULT: "#0f172a",
          accent: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};

export default config;
