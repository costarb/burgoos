import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // RRFive OS identity: violet-black ink, electric-indigo primary,
        // raspberry-coral spark (sparing use), violet-tinted paper background.
        // "tomato"/"cream" keys kept for compatibility with existing classes.
        ink: "#1b1730",
        tomato: "#5b3df6",
        "tomato-deep": "#3b22c4",
        spark: "#ff5c8a",
        leaf: "#2f7d57",
        cream: "#faf9fc"
      }
    }
  },
  plugins: []
};

export default config;
