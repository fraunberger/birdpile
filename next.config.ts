import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@clerk/nextjs/server": path.resolve(__dirname, "src/lib/clerk-stub/server.ts"),
      "@clerk/nextjs": path.resolve(__dirname, "src/lib/clerk-stub/index.tsx"),
    };
    return config;
  },
};

export default nextConfig;
