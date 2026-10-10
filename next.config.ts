import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Vercel image-optimization cache writes low: few widths per image,
  // and cache optimized images for 31 days instead of the 4-hour default.
  images: {
    deviceSizes: [640, 1080],
    imageSizes: [64, 128, 256],
    minimumCacheTTL: 2678400,
  },
  // Prizmiker is a static export in public/prizmiker; serve its page at
  // /prizmiker (before the [slug] bird route can claim the path)
  async rewrites() {
    return {
      beforeFiles: [{ source: "/prizmiker", destination: "/prizmiker/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
