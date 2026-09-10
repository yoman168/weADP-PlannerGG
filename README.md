# WE-ADK

The WE-ADK UI, extracted from the ProductFlow monorepo as a standalone Next.js
app. Same screens, same data, same behaviour — without the PLM product, the Nest
API, Postgres, Redis or auth.

```bash
pnpm install
pnpm dev          # http://localhost:3000 (also served on the LAN)
```

Other scripts: `pnpm build`, `pnpm start` (production server), `pnpm typecheck`.

## Docker

```bash
docker compose up -d --build                     # app + db, loopback only
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3003/we-adk

docker compose --profile tunnel up -d            # + a public URL
docker compose logs tunnel | grep trycloudflare  # read that URL
```

The image builds with `BUILD_TARGET=standalone`, so unlike the default `export`
target it is a real Node server and the routes under `src/app/api` **run** — that
is the whole backend this app has. It listens on `127.0.0.1:3003` (3000–3002 are
taken by other containers on this machine). `@anthropic-ai/claude-code` is
installed in the image so the Claude bridge has a `claude` on PATH.

The `tunnel` profile starts this project's own edge: an nginx plus a cloudflared,
reaching the app over the compose network so the app stays loopback-bound.

This is the **second** of two edges on this machine, deliberately separate so a
URL shared with one audience does not expose every other project's paths:

```text
Edge A — this repo, deploy/nginx/we-adk.conf
  cloudflared → we-adk-edge :8080
       ├─ /ohmycmo/  → host.docker.internal:8889  OhMyCMO
       └─ /          → app:3000                   WE-ADK (catch-all)

Edge B — we-testcase-ms/deploy/edge
  cloudflared → macmini-edge :8080
       ├─ /cases/       → :3000  we-testcase
       ├─ /securescan/  → :3001  SecureScan
       └─ /ptas168/     → :8082  PTAS168
```

we-adk is Edge A's catch-all rather than a `/we-adk/` prefix, which is why
`BASE_PATH` can stay empty: its routes already begin with `/we-adk`, and `/eacc`,
`/api` and `/_next` come along for free without enumerating them. Adding a third
app here just means one more `location` above the catch-all.

That nginx is not optional. Cloudflare percent-encodes `(` and `[` in Next.js
chunk paths, and Next 15 returns 404 when both are encoded in one URL. This app
has a `(workspace)` route group under `[projectId]`, so pointing cloudflared
straight at the app makes the sketcher **edit and preview pages fail outright** —
`Application error: a client-side exception has occurred`, from a `ChunkLoadError`
on `(workspace)/layout-….js`. nginx's `$uri` is already decoded, so
`proxy_pass http://app$uri` hands the app the literal path and it serves it. See
[deploy/nginx/we-adk.conf](deploy/nginx/we-adk.conf). It is behind a profile because a
free Quick Tunnel's hostname is random and changes whenever that container is
recreated — this way rebuilding the app leaves the public URL alone. Note that
`docker compose restart tunnel` does **not** mint a new hostname; cloudflared
reuses stale state from the container filesystem and comes back registered but
unreachable. Force a genuinely new one with:

```bash
docker compose --profile tunnel up -d --force-recreate --no-deps tunnel
```

`BASE_PATH` is empty by default, which suits the own-tunnel setup: the app owns
the whole hostname and serves `/we-adk` directly. The alternative is the shared
Mac mini nginx edge, which fronts five apps on one hostname and routes by path
prefix without stripping it — that needs `BASE_PATH=/adk` in `.env` plus a
rebuild, since Next inlines it into every `/_next` URL at build time. See
[deploy/EDGE.md](deploy/EDGE.md) and [deploy/patch-edge.py](deploy/patch-edge.py).

Three build targets, selected by `BUILD_TARGET`:

| Target | Output | API routes |
| --- | --- | --- |
| `standalone` | `node server.js` — the Docker image | run |
| `export` | static HTML for `pnpm build:cf` | **dropped** |
| `dev` | `next dev` | run |

Serving it publicly means adding one route to the shared Cloudflare tunnel edge
— see [deploy/EDGE.md](deploy/EDGE.md). Read it before restarting anything: the
tunnel is a free Quick Tunnel whose URL is shared with four other projects and
changes on every restart.

### Database

`docker compose up -d` also starts Postgres 16 on `127.0.0.1:5436` (5432–5435
are taken by other projects on this machine). Credentials come from `.env`,
which is gitignored — `cp .env.example .env` and put a generated password in it.

[deploy/db/01-schema.sql](deploy/db/01-schema.sql) is applied once, on an empty
volume, by the image's `initdb` hook. It models the durable domain from
`src/lib/we-adk-mock/` — projects, meetings, the folder tree, design files,
canvas blocks, concept and production screens, tasks, comments, activity — as 10
tables and 9 enums. The presentational types (`CHIP_CLASSES`, `ButtonVariant`,
the `BlockProps` catalogue) are deliberately left in the bundle.

**Nothing reads from it yet.** Every screen still renders from the mock modules
and `localStorage`; the schema is the target shape for that migration, and a
place to point a SQL client at meanwhile. There is also no migration tool wired
up, so changing the schema means dropping the data:

```bash
docker compose down -v && docker compose up -d
```

## Structure

```
/                                        → redirects to the project list
/we-adk                                  Your projects — the entry screen
/we-adk/projects/<projectId>             Project overview: pipeline stage, folders, meetings
                 …/sketcher              Design files (folder tree + file list)
                 …/sketcher/board        Frames, and meeting notes → generated screens
                 …/builder               Work mockups, requirements spec, feature specs, tests, manuals
                 …/developer             Harness-based development console
/we-adk/canvas?screen=…&project=…        The shared block canvas editor
/we-adk/production                       Every screen captured from a live product, across projects
/we-adk/devadmin                          Token, usage and security operations
/we-adk/architecture                      How the four tools fit together
```

Tools live **inside** a project: a project walks from concept sketches
(Sketcher) through a spec and working screens (Builder) into development
(Developer). DevAdmin is org-level.

## Data

Everything is mock data in `src/lib/we-adk-mock/` — no API calls, no database.
Design files that you create in the UI (generated from notes, copied from a real
screen, or started blank) and every canvas edit persist to `localStorage`, so
they survive a reload without pretending there is a backend.

## Claude bridge

Two routes shell out to your local Claude Code install:

- `POST /api/sketcher/generate` — meeting notes → proposed screens (the board's
  "Generate screens")
- `POST /api/sketcher/ai` — the canvas editor's AI chat
- `POST /api/developer/prompt` — the Developer console's prompt

They need the `claude` CLI on `PATH`. Everything else works without it.

## What came across

`src/components/ui/` holds only the design-system primitives these screens use,
copied from the monorepo's `@productflow/ui` (shadcn-style: Radix + Tailwind v4).
Left behind: the ProductFlow PLM app, the Nest API and its Prisma schema,
authentication, react-query, sockets, and the unit/e2e test setup.
