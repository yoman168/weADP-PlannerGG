# Production image for we-adk (single-package repo, pnpm).
#
#   docker compose up -d --build
#   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3003/adk/we-adk
#
# Built as `output: 'standalone'` (BUILD_TARGET), NOT the default `export`, so
# the route handlers under src/app/api actually run. `pnpm build:cf` still uses
# the export target for the Cloudflare Workers deploy.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@11.3.0 --activate
# pnpm reads its settings from pnpm-workspace.yaml even though this is not a workspace.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# No next/image anywhere in src/, so sharp is genuinely unused; skipping install
# scripts also avoids pnpm's build-approval prompt for esbuild/workerd.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@11.3.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# URL prefix on the shared Mac mini nginx edge. Baked in at build time because
# Next inlines basePath into the client bundle and every /_next asset path.
ARG BASE_PATH=/adk
ENV BASE_PATH=$BASE_PATH
ENV BUILD_TARGET=standalone
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ARG BASE_PATH=/adk
ENV BASE_PATH=$BASE_PATH

# git + ripgrep are what the Claude Code CLI expects to find on PATH; without
# the CLI the /api/sketcher/* routes still answer, with a clean "not found"
# error instead of a screen full of blocks.
RUN apk add --no-cache libc6-compat dumb-init git ripgrep \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && npm install -g @anthropic-ai/claude-code \
  && npm cache clean --force \
  && claude --version

# Next standalone server: the traced server plus the two things it does not trace.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The Claude bridge writes a per-token config dir under the OS temp dir.
RUN mkdir -p /tmp/we-adk-claude-config && chown -R nextjs:nodejs /tmp/we-adk-claude-config

USER nextjs
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
