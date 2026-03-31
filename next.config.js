/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDF 파싱 등 서버사이드에서 사용하는 Node.js 모듈 설정
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  // pdfjs-dist의 canvas 의존성을 webpack에서 무시 (브라우저에서는 불필요)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas = false;
    }
    return config;
  },
};

module.exports = nextConfig;
