import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // built as a standalone server so the container image stays small
  output: "standalone",
};

export default nextConfig;
