/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDF 파싱 등 서버사이드에서 사용하는 Node.js 모듈 설정
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

module.exports = nextConfig;
