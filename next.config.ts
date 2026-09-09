import type { NextConfig } from 'next';

/**
 * Which kind of build this is.
 *
 * Two production targets, and they are not interchangeable. `export` writes static files
 * for Cloudflare and cannot contain route handlers at all — which is why the AI proxies
 * under `src/app/api` do not exist in that build. `standalone` writes a Node server that
 * can, and is what the Docker image runs, so the whole application works there including
 * the proxies.
 *
 * The default is unchanged from before Docker existed: `export` in production, nothing in
 * development. Standalone is opt-in through `NEXT_OUTPUT`, so `pnpm build` and
 * `pnpm deploy:cf` behave exactly as they always have.
 */
function output(): 'export' | 'standalone' | undefined {
  const requested = process.env.NEXT_OUTPUT;
  if (requested === 'standalone' || requested === 'export') return requested;
  return process.env.NODE_ENV === 'production' ? 'export' : undefined;
}

const selected = output();

const nextConfig: NextConfig = {
  ...(selected ? { output: selected } : {}),
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
