import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['@uiw/react-md-editor'],
  },
  distDir: 'dist',
};

export default nextConfig;
