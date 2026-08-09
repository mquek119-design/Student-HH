/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'digitalcontent.api.tesco.com' },
    ],
  },
  experimental: {
    // Playwright + the vendored Tesco provider must never be bundled for the
    // client or the edge runtime. Keep them external to the server bundle.
    // (Renamed to `serverExternalPackages` in Next 15 — update on upgrade.)
    serverComponentsExternalPackages: ['playwright', 'playwright-core'],
  },
};

module.exports = nextConfig;
