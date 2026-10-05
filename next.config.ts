import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Menus and the restaurant registry are read from data/ at request time.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
  },
};

export default nextConfig;
