import type { NextConfig } from "next";

// 환경변수에서 백엔드 URL 가져오기 (Vercel 배포용)
// 서버사이드 전용 환경변수 (NEXT_PUBLIC_ 없음) - 클라이언트에 노출되지 않음
const SOUL_API_URL = process.env.SOUL_API_URL || 'http://localhost:8000';
const YEIRIN_API_URL = process.env.YEIRIN_API_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // ============================================
      // Soul-E AI Backend (FastAPI) - Port 8000
      // LLM 채팅, 세션 관리, 심리평가 등
      // ============================================
      {
        source: '/soul-api/:path*',
        destination: `${SOUL_API_URL}/api/v1/:path*`,
      },

      // ============================================
      // Yeirin Main Backend (NestJS) - Port 3000
      // 인증, 사용자 관리, 아동 정보 등
      // ============================================
      {
        source: '/yeirin-api/:path*',
        destination: `${YEIRIN_API_URL}/:path*`,
      },
    ];
  },
  // WASM 파일을 위한 헤더 설정 (VAD용)
  async headers() {
    return [
      {
        source: '/vad/:path*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
        ],
      },
      {
        source: '/vad/:path*.onnx',
        headers: [
          { key: 'Content-Type', value: 'application/octet-stream' },
        ],
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

    // WASM 지원 (VAD용)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    return config
  },
};

export default nextConfig;
