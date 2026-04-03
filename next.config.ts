import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['@uiw/react-md-editor'],
  },
  // Capacitor 需要静态导出
  output: 'export',
  distDir: 'out',
};

export default nextConfig;
