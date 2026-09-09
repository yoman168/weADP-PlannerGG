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
docker compose up -d --build
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3003/adk/we-adk
```

The image builds with `BUILD_TARGET=standalone`, so unlike the default `export`
target it is a real Node server and the routes under `src/app/api` **run** — that
is the whole backend this app has. It listens on `127.0.0.1:3003` (3000–3002 are
taken by other containers on this machine) under `BASE_PATH=/adk`, ready for the
shared nginx edge. `@anthropic-ai/claude-code` is installed in the image so the
Claude bridge has a `claude` on PATH.

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
