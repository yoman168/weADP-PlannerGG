import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export for Cloudflare builds; skipped in dev so next dev works normally.
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' as const } : {}),
  /**
   * Where the build lands. `next dev` does not vary this by port, so two dev
   * servers in this project overwrite each other's `.next` — the stylesheet
   * 404s, routes start answering 404 after a minute, and a manifest gets read
   * mid-write ("Unexpected non-whitespace character after JSON"). Give each
   * server its own directory to keep them apart:
   *
   *   NEXT_DIST_DIR=.next-3001 pnpm dev -- --port 3001
   *
   * Unset, it is the default `.next`, so builds and deploys are unaffected.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  /**
   * No dev-tools badge.
   *
   * The floating circle it pins to the bottom-left sits over the app's own
   * chrome, and in a UI mockup being read as the product it is one more thing
   * to explain away. Build output is unaffected — the badge only ever appears
   * in `next dev`.
   */
  devIndicators: false,
  /**
   * Hostnames allowed to request /_next/* in dev. A cloudflared quick tunnel
   * serves the app from a random *.trycloudflare.com host, which Next treats
   * as cross-origin; without this it warns now and blocks in a future major.
   * Dev-only — production builds ignore it.
   */
  allowedDevOrigins: ['*.trycloudflare.com'],
};

export default nextConfig;
