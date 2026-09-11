# CLAUDE.md

## Server health check

After making changes, always verify the dev server responds:

```bash
curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/we-adk
```

If it returns `000` (timeout) or `500`:

1. Kill all processes: `lsof -ti:3000 | xargs kill -9 2>/dev/null; pkill -9 -f "claude --print" 2>/dev/null`
2. Clear cache: `rm -rf .next`
3. Restart: `npx next dev --hostname 0.0.0.0 --port 3000`
4. Wait 8 seconds, then check again
5. If still failing, check for TypeScript errors: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v node_modules`

Common causes of hangs:
- Stale `.next` cache — always `rm -rf .next` before restart
- Orphan `claude --print` processes from AI chat — kill with `pkill -9 -f "claude --print"`
- Context providers wrapping server components in `layout.tsx` — keep client providers inside client components only

## Project structure

- `src/app/api/` — API routes (restored from `src/app/_api/` for dev mode)
- `src/app/_api/` — backup of API routes (used for static export builds)
- `next.config.ts` — `output: 'export'` only in production, skipped in dev
- Toast: use `showToast()` or `useToast()` from `@/components/ui/toast` — no provider wrapping needed
- `scripts/claude-bridge.mjs` — the `claude` CLI behind the Messages API. While `CLAUDE_BRIDGE_URL` is set (dev), the API (`backend/`) sends every AI call through it, any caller or server key included; without it (prod) the key is used directly. Runs as the `claude-bridge` container, which signs in with `CLAUDE_CODE_OAUTH_TOKEN` from the git-ignored `deploy/dev.secrets.env` (`claude setup-token` mints it)
- Every service runs in Docker — `pnpm stack:dev` brings up postgres, api, web and claude-bridge, and `pnpm stack:dev:tunnel` adds the two cloudflared containers behind compose's `tunnel` profile. Nothing is left running on the host
- `scripts/lib/stack-env.sh` — the compose project name and its layered env files, shared by `stack.sh`, `tunnel.sh` and `release.sh` so all three drive the same stack
- CI/CD is `.github/workflows/ci.yml` (test → contract → shellcheck and compose → images to ghcr.io) and `deploy.yml` (SSH to the host, then `scripts/release.sh`). A release is `deploy/<env>.release.env` on the host: while it exists, `deploy/compose.release.yml` is layered on and the stack runs published images instead of building. Anything written to that file must be followed by re-sourcing `stack-env.sh`, which decides the compose invocation when it is sourced. README.md → "Shipping it"
