/* global process */
/** @type {import("next").NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  transpilePackages: ["@rrfive/ui", "@rrfive/types"]
};

export default nextConfig;
