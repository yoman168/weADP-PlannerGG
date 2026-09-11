# The local Claude bridge, as a service in the stack.
#
# Claude Code and one script: scripts/claude-bridge.mjs answers the Anthropic Messages API
# by running `claude --print`, and the API talks to it instead of api.anthropic.com when it
# has no key. See that file for what it is and why.
#
# Debian rather than Alpine, unlike the web image. Claude Code ships native helpers built
# against glibc, and on musl they fail in ways that surface as a mystery at the first
# request rather than at install time.
FROM node:22-slim AS runtime

# Bumped by rebuilding: `docker compose build claude-bridge`. Pin it here when a release
# misbehaves — the bridge only uses `--print`, which is the CLI's most stable surface.
ARG CLAUDE_CODE_VERSION=latest
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
    && npm cache clean --force

# Not root. Claude Code treats a root session as a reason to warn, and nothing here needs
# the privilege — the image is one script serving one port. `node` ships with the image;
# it gets a home of its own because the CLI writes its config and cache there.
ENV HOME=/home/node
RUN mkdir -p /home/node /app && chown -R node:node /home/node /app
WORKDIR /app
COPY --chown=node:node scripts/claude-bridge.mjs ./claude-bridge.mjs
USER node

# The compose network, not loopback: on the host the bridge binds 127.0.0.1 because an
# unauthenticated Messages API has no business on the LAN, and in here the equivalent is
# binding the container's own interface and publishing no port. Only the stack can reach it.
ENV CLAUDE_BRIDGE_HOST=0.0.0.0
ENV CLAUDE_BRIDGE_PORT=8788
EXPOSE 8788

# Node's own fetch rather than curl, which this image does not carry.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "/app/claude-bridge.mjs"]
