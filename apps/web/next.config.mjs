/* global process */
/** @type {import("next").NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  transpilePackages: ["@rrfive/ui", "@rrfive/types"],
  // Version shown in the admin (commit filled by Render on every deploy from git).
  env: {
    NEXT_PUBLIC_APP_COMMIT: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "",
    NEXT_PUBLIC_APP_BUILT_AT: new Date().toISOString()
  }
};

export default nextConfig;
