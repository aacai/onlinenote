import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 勿把 distDir 设为静态导出目录：会与 output:export 产物混在一起，
  // 导致 next dev / next start 缺少 routes-manifest.json 等文件。
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
