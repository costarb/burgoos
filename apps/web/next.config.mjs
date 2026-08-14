/* global process */
/** @type {import("next").NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  transpilePackages: ["@burgoos/ui", "@burgoos/types"]
};

export default nextConfig;
