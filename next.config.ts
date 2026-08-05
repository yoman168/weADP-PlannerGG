import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle, so `next build` output can ship as-is.
  output: 'standalone',
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
};

export default nextConfig;
