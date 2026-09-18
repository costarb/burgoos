import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        // RRFive OS identity: Archivo Black for the brand/display face
        // (page titles, wordmark), IBM Plex Sans for interface text,
        // IBM Plex Mono for order codes, money and timestamps.
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Arial Black", "sans-serif"],
        mono: ["var(--font-mono)", "SFMono-Regular", "Consolas", "monospace"]
      },
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
      },
      keyframes: {
        "nav-progress-sweep": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" }
        }
      },
      animation: {
        "nav-progress-sweep": "nav-progress-sweep 1.1s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
