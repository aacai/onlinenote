import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: 'localhost' }],
  },
  experimental: {
    optimizePackageImports: ['@uiw/react-md-editor'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  // Tauri 使用 standalone 输出模式
  output: 'standalone',
  // 确保生成所有页面
  distDir: '.next',
};

export default nextConfig;
