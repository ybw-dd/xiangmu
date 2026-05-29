/** @type {import('next').NextConfig} */
const nextConfig = {
  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
      },
    ],
  },

  // 实验性功能
  experimental: {},

  // 服务端外部包
  serverExternalPackages: [],

  // standalone 仅在 Docker 构建时使用（通过环境变量控制）
  ...(process.env.DOCKER_BUILD === 'true' && { output: 'standalone' }),
};

module.exports = nextConfig;
