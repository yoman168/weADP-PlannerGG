# CLAUDE.md

## Ports on this machine

Docker holds **3000–3003**, so the dev server cannot use its old default of
3000. Use **3004**:

```bash
NEXT_DIST_DIR=.next-3004 npx next dev --hostname 0.0.0.0 --port 3004
```

`NEXT_DIST_DIR` keeps concurrent dev servers from overwriting each other's
build directory — see the comment in `next.config.ts`.

> **Never run `lsof -ti:3000 | xargs kill -9`.** Port 3000 is held by
> `com.docker.backend`, not by a stray Next process. Killing it takes down every
> container on this machine, including the shared `macmini-tunnel` and four other
> projects' databases. Kill by name instead:
> `pkill -f "next dev"`.

## Server health check

After making changes, verify whichever instance you are working on responds:

```bash
# dev server (port from above)
curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://localhost:3004/we-adk

# the Docker container (BASE_PATH is empty by default; /adk only for the shared edge)
curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3003/we-adk
```

If it returns `000` (timeout) or `500`:

1. Kill the dev server by name: `pkill -f "next dev"; pkill -9 -f "claude --print" 2>/dev/null`
2. Clear cache: `rm -rf .next .next-3004`
3. Restart it (command above)
4. Wait 8 seconds, then check again
5. If still failing, check for TypeScript errors: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v node_modules`

Common causes of hangs:

- Stale `.next` cache — always `rm -rf .next` before restart
- Orphan `claude --print` processes from AI chat — kill with `pkill -9 -f "claude --print"`
- Context providers wrapping server components in `layout.tsx` — keep client providers inside client components only

## Project structure

- `src/app/api/` — API routes (restored from `src/app/_api/` for dev mode)
- `src/app/_api/` — backup of API routes (used for static export builds)
- Toast: use `showToast()` or `useToast()` from `@/components/ui/toast` — no provider wrapping needed

## Build targets

`next.config.ts` picks its output from `BUILD_TARGET`:

| `BUILD_TARGET` | Output | API routes |
| --- | --- | --- |
| unset in dev | `next dev` | run |
| `export` (default in production) | static HTML, for `pnpm build:cf` | **dropped** |
| `standalone` | `node server.js`, the Docker image | run |

The `export` target drops everything under `src/app/api/` **without erroring**.
If an API route 404s in a built app, check the target before debugging the route.

`BASE_PATH` sets Next's `basePath`. It is empty by default, which is what the
own-tunnel setup wants; `/adk` is only for the shared nginx edge. Either way it
is baked into the client bundle and every `/_next` URL at build time, so changing
it needs a rebuild, not a restart. Anything that reconstructs a URL server-side
must account for it — see the two comments in
`src/app/api/prototype/[slug]/route.ts`.

## Docker

```bash
docker compose up -d --build     # app on 127.0.0.1:3003, postgres on 127.0.0.1:5436
```

Credentials come from the gitignored `.env` (`cp .env.example .env`). The schema
in `deploy/db/01-schema.sql` applies only via the `initdb` hook on an empty
volume, so schema changes need `docker compose down -v`, which destroys the data.
Nothing in the app queries the database yet.

Public access goes through a Cloudflare tunnel shared with four other projects —
read [deploy/EDGE.md](deploy/EDGE.md) before touching it. **Never restart
`macmini-tunnel`**: it is a Quick Tunnel and mints a new random public URL for
every project on every restart.

## Package manager

pnpm (`packageManager: pnpm@11.3.0`). Do not create a `package-lock.json`.
