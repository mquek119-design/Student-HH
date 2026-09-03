/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Dev and production builds get separate output directories.
   *
   * By default both `next dev` and `next build` write to `.next`, and they
   * write incompatible things there. The symptoms are unhelpful and were hit
   * repeatedly on this project:
   *
   *   - `next build` while the dev server is running replaces its assets, so
   *     every chunk 404s and the app renders unstyled or throws
   *     MODULE_NOT_FOUND.
   *   - `next start` after `next dev` fails with "Could not find a production
   *     build", because dev artefacts are sitting where the build should be.
   *
   * `next dev` runs with NODE_ENV=development; `next build` and `next start`
   * both run as production. Splitting on that keeps them entirely apart, so
   * the two commands can be used in any order without clearing anything.
   */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'digitalcontent.api.tesco.com' },
    ],
  },
  // Playwright + the vendored Tesco provider must never be bundled for the
  // client or the edge runtime. Keep them external to the server bundle.
  // Top-level since Next 15.0.0 — the old `experimental.serverComponentsExternalPackages`
  // key this project is on Next 16 was silently a no-op.
  serverExternalPackages: [
    'playwright',
    'playwright-core',
    'playwright-extra',
    'puppeteer-extra-plugin-stealth',
  ],
};

module.exports = nextConfig;
