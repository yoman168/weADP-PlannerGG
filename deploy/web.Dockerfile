# The workspace image.
#
# Four stages, two of them targets. `dev` runs the Next dev server against a bind-mounted
# source tree, which is what the dev stack uses; `runtime` runs a built Node server, which
# is what the prod stack uses.
#
# The prod build is `output: 'standalone'` rather than the static export this project uses
# for Cloudflare, and the difference is not cosmetic: a static export cannot contain route
# handlers, so the AI proxies under `src/app/api` simply do not exist in it. The Node build
# has them, which is why the whole application works in a container.

FROM node:22-alpine AS base
WORKDIR /app
# corepack respects the `packageManager` field, so the image uses the same pnpm the lockfile
# was written with. The prompt would otherwise block a non-interactive build.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# ------------------------------------------------------------------ #
# Dependencies                                                        #
# ------------------------------------------------------------------ #
# Only the manifests, so this layer is reused until a dependency actually changes. Copying
# the source first would reinstall everything on every edit.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------ #
# Development                                                        #
# ------------------------------------------------------------------ #
# The source arrives as a bind mount at runtime, so nothing is copied here. `node_modules`
# stays the one installed above — the compose file masks the mounted host copy, which was
# built for a different platform.
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "dev"]

# ------------------------------------------------------------------ #
# Build                                                              #
# ------------------------------------------------------------------ #
FROM deps AS builder
COPY . .

# Inlined into the browser bundle at build time, which is why they are build arguments and
# not environment variables: `NEXT_PUBLIC_*` is substituted during the build and cannot be
# changed afterwards. An image is therefore built for the URL it will be served from.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ARG NEXT_PUBLIC_OAUTH_CLIENT_ID=we-adk-workspace
# BUILD_TARGET, not NEXT_OUTPUT: next.config.ts reads one name for this, and it is
# the one the root docker-compose image and CLAUDE.md already use. `export` would
# silently drop every route handler under src/app/api, which is most of why this
# image exists.
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_OAUTH_CLIENT_ID=$NEXT_PUBLIC_OAUTH_CLIENT_ID \
    BUILD_TARGET=standalone
RUN pnpm build

# ------------------------------------------------------------------ #
# Runtime                                                            #
# ------------------------------------------------------------------ #
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Not root. A web process that is compromised should not also own its own filesystem.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# `standalone` is a self-contained server with only the modules it actually reached, so the
# rest of node_modules is deliberately left behind. `static` and `public` are not inside it
# and have to come across separately, which is the step everyone forgets — the application
# runs and every stylesheet is a 404.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/we-adk').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
