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
        ink: "#1f2933",
        tomato: "#d83a2e",
        leaf: "#2f7d57",
        cream: "#fff8ed"
      }
    }
  },
  plugins: []
};

export default config;
