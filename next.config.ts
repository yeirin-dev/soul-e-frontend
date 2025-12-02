import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // ============================================
      // Soul-E AI Backend (FastAPI) - Port 8000
      // LLM 채팅, 세션 관리, 심리평가 등
      // ============================================
      {
        source: '/soul-api/:path*',
        destination: 'http://localhost:8000/api/v1/:path*',
      },

      // ============================================
      // Yeirin Main Backend (NestJS) - Port 3000
      // 인증, 사용자 관리, 아동 정보 등
      // ============================================
      {
        source: '/yeirin-api/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ];
  },
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  // Turbopack configuration (Next.js 16 default)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // Webpack fallback configuration
  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule: any) =>
      rule.test?.test?.('.svg')
    )

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
        use: ['@svgr/webpack'],
      }
    )

    fileLoaderRule.exclude = /\.svg$/i

    return config
  },
};

export default nextConfig;
