import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["app/**/*.spec.ts", "app/**/*.spec.tsx", "components/**/*.spec.tsx"]
  }
});
