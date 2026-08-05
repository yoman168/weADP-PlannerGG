# WE-ADK

The WE-ADK UI, extracted from the ProductFlow monorepo as a standalone Next.js
app. Same screens, same data, same behaviour — without the PLM product, the Nest
API, Postgres, Redis or auth.

```bash
pnpm install
pnpm dev          # http://localhost:3000 (also served on the LAN)
```

Other scripts: `pnpm build`, `pnpm start` (production server), `pnpm typecheck`.

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
