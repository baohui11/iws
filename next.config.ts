import type { NextConfig } from "next";

/**
 * - Server Actions 体积分摊在 experimental.serverActions（顶层 serverActions 无效）
 * - 使用 Proxy 时请求体会被缓冲，需同时提高 experimental.proxyClientMaxBodySize（默认 10MB）
 */
const nextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
    proxyClientMaxBodySize: "500mb",
  },
  allowedDevOrigins: [
    "http://192.168.16.201:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
} as NextConfig;

export default nextConfig;
