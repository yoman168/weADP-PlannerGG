# WE-ADK

The WE-ADK workspace: a Next.js app, and the Spring Boot API in [`backend/`](backend) that
serves it.

```bash
pnpm stack:dev          # Postgres, the API, the workspace and the Claude bridge, in Docker
```

That is the whole system: four containers, one command. `http://localhost:3000` when it
comes up.

## Two stacks

Everything runs in Docker, twice. `dev` and `prod` are independent stacks with their own
containers, their own volumes and their own ports, so both can run at once and neither can
be mistaken for the other.

|                  | dev                               | prod                        |
| ---------------- | --------------------------------- | --------------------------- |
| Workspace        | 3000                              | 3100                        |
| API              | 8080                              | 8180                        |
| Postgres         | 5433                              | 5434                        |
| Database browser | 8090                              | 8190                        |
| Web server       | `next dev`, source mounted        | built Node server, non-root |
| API server       | `spring-boot:run`, source mounted | packaged jar on a JRE       |

```bash
pnpm stack:dev                 # build if needed, then start
pnpm stack:dev:down            # stop, keeping the database
pnpm stack:dev:logs api        # follow one service
pnpm stack:dev:tools           # add the database browser
pnpm stack:dev:urls            # where it is answering, tunnels included
pnpm stack:prod                # the same, for the other stack

bash scripts/stack.sh dev ps
bash scripts/stack.sh dev reset   # stop and DELETE that stack's database
```

### On the internet

```bash
pnpm stack:dev:tunnel          # add two cloudflared containers, print the public URLs
pnpm stack:dev:tunnel:stop     # remove them; the stack goes back to localhost only
```

Cloudflare quick tunnels, so no account and no DNS — and the price is that the hostname is
new every time one starts. `scripts/tunnel.sh` captures both and writes them into the
git-ignored `deploy/dev.local.env`, because the API has to be told: it is the OAuth2 issuer,
a CORS origin and a redirect URI, all of which the browser checks. Localhost keeps working
alongside them.

Forgotten the hostname? `pnpm stack:dev:urls` reads it back out of the running containers.

Every command carries the environment as its first word. There is deliberately no "current"
stack to be wrong about, and `reset` makes you type the stack name before it deletes
anything.

The difference between the two is real rather than cosmetic. The dev stack mounts the source
and runs the servers that reload, so a saved file is a reload rather than a rebuild. The prod
stack builds images and mounts nothing — and the web image is a Node build rather than the
static export this project uses for Cloudflare, because a static export cannot contain route
handlers and the AI proxies would simply not exist in it.

Configuration is `deploy/dev.env` and `deploy/prod.env`. The dev one is committed, because
every value in it is a port or a throwaway credential for a local volume. The prod one is
git-ignored; copy `deploy/prod.env.example` and fill it in.

One thing to know before changing a URL: `PUBLIC_API_URL` is inlined into the browser bundle
when the web image is built, so moving it needs `pnpm stack:prod` again rather than a
restart. It also has to be a URL the browser can reach, because it becomes the OAuth2 issuer,
the registered redirect URI and the CORS origin, all of which the browser checks. Inside the
stack the web server reaches the API at `http://api:8080` instead — a name only the stack can
resolve, which is `API_INTERNAL_URL`, and the two are genuinely different values.

Cloudflare is still a target for the workspace alone: `pnpm build` and `pnpm deploy:cf` are
unchanged, and produce the static export they always did. Run `pnpm approve-builds` first,
since that path wants esbuild and workerd to have run their install scripts.

## Shipping it

```
pull request   →  tests, contract check, both images built            nothing published
push to main   →  the same, then published to ghcr.io, then deployed
push of a tag  →  the same, published; deployed when someone says so
```

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) is the pipeline and
[`deploy.yml`](.github/workflows/deploy.yml) is the release. The jobs, in order:

| Job      | What it decides                                                                  |
| -------- | -------------------------------------------------------------------------------- |
| `api`    | The Java tests pass, and exports the OpenAPI document from the service it boots   |
| `web`    | The committed contract and generated types match that document, and TypeScript compiles |
| `stack`  | `shellcheck` on the deploy scripts, and every compose stack resolves              |
| `images` | Both images build; on a push they are pushed to `ghcr.io/<owner>/we-adk/{api,web}` |
| `deploy` | On `main` only: the images just published are put on the host                     |

Images are tagged three ways — `sha-1a2b3c4` for every commit, the branch or git tag's own
name, and `latest` from `main`. The sha tag is what a deploy is given, because it is the one
that names exactly one build.

A tag publishes and stops there. Releasing it is running **Deploy** from the Actions tab with
`v1.2.0` in the box, which is the same path a rollback takes, with an older tag.

### What the host needs

One machine with Docker and the compose plugin, a user in the `docker` group, and one file:

```bash
mkdir -p ~/we-adk/deploy
# deploy/prod.env.example in this repository is the template. Fill in the real values.
$EDITOR ~/we-adk/deploy/prod.env
```

That file is the only thing on the host the pipeline does not send, and it is deliberate:
the database password and the Anthropic key belong to the host and never pass through
GitHub. Everything else — the compose files and the scripts that drive them — is shipped on
every run, so the host is never a branch of this repository that has drifted.

Then, on GitHub, under the repository's **Settings → Secrets and variables → Actions**:

| Name                 | Kind                   | What it is                                                  |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| `PUBLIC_API_URL`     | variable               | The API URL the browser will use. Compiled into the bundle. |
| `OAUTH_CLIENT_ID`    | variable, optional     | Defaults to `we-adk-workspace`                              |
| `DEPLOY_HOST`        | variable (`production` environment) | The host to deploy to. Unset, the deploy step says so and passes |
| `DEPLOY_USER`        | variable, optional     | Defaults to `deploy`                                        |
| `DEPLOY_PORT`        | variable, optional     | Defaults to `22`                                            |
| `DEPLOY_PATH`        | variable, optional     | Defaults to `~/we-adk`                                      |
| `PUBLIC_WEB_URL`     | variable, optional     | Only to label the deployment in GitHub's UI                 |
| `DEPLOY_SSH_KEY`     | secret                 | A private key whose public half is in that user's `authorized_keys` |
| `DEPLOY_KNOWN_HOSTS` | secret, strongly advised | `ssh-keyscan -H your.host` — without it the first connection trusts whatever answers |

No registry credential is needed. The job signs in to ghcr.io as itself, with a token that
expires when it finishes.

`PUBLIC_API_URL` is a repository variable rather than an environment one because the image
is built before any environment is in play — and it has to be right, because
`NEXT_PUBLIC_API_BASE_URL` is compiled into the browser bundle and cannot be moved by
restarting anything. CI stamps the URL it built with onto the image as a label and
`scripts/release.sh` refuses a release whose label disagrees with the host's `prod.env`,
before it stops anything. That check is the difference between finding this out here and
finding it out in a browser console.

### On the host

[`scripts/release.sh`](scripts/release.sh) is what the deploy job runs over SSH, and it is
an ordinary script you can run yourself:

```bash
cd ~/we-adk
bash scripts/release.sh status      # what is running, and what it was released from
bash scripts/release.sh rollback    # the release before this one
bash scripts/release.sh v1.2.0      # or any tag that exists in the registry
```

It pulls both images, writes `deploy/prod.release.env`, and starts the stack. That file is
what makes the difference: while it exists, `scripts/lib/stack-env.sh` layers
[`deploy/compose.release.yml`](deploy/compose.release.yml) on, and the api and web services
run the published images rather than building from source. Delete it and `pnpm stack:prod`
builds on the host again, exactly as before.

Then it waits for both containers to report healthy — the API's is its readiness probe, so
it is false until Flyway has finished — and if they do not, it puts the previous release
back and fails. `pnpm stack:prod:logs api` for what happened.

**Migrations are not part of that.** Flyway runs inside the API at startup and only goes
forward, so a rollback returns the code and leaves the schema where the release left it. A
migration that older code cannot read is therefore a thing to think about before it ships:
add columns, do not repurpose them, and drop one only after a release that no longer reads
it is the one you would roll back to.

## Running it without Docker

Still supported, and quicker for tight iteration on the frontend:

```bash
pnpm install
pnpm stack:dev          # then stop just the web container, or use the prod stack's API
pnpm dev                # the workspace on 3000, outside Docker
```

For the API on its own, `backend/README.md` has the details. One trap: there is no linked
system JDK on a stock macOS, so `./gradlew` fails with "Unable to locate a Java Runtime" until
`export JAVA_HOME=/opt/homebrew/opt/openjdk@21`.

Other scripts: `pnpm build`, `pnpm typecheck`, and the three contract scripts under
[The API contract](#the-api-contract).

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
src/  public/  next.config.ts   the workspace (Next.js)
backend/                        the API (Spring Boot)
deploy/                         Dockerfiles, compose files, per-environment settings
openapi/                        the contract the TypeScript client is generated from
scripts/                        stack control, contract export, the release, the OAuth2 flow check
.github/workflows/              the pipeline, and the deploy it ends in
```

Everything to do with running the system lives in `deploy/`, including the two Dockerfiles.
They are there rather than beside the code they build because there are two of them and one
of each service — keeping them together is what makes the pair legible, and BuildKit reads a
`<dockerfile>.dockerignore` next to each one, so their exclusion lists travel with them.

The routes inside the workspace:

```
/                                        → redirects to the project list
/login                                   Sign in (starts the OAuth2 flow)
/auth/callback                           Where the authorization server returns to
/we-adk                                  Your projects — the entry screen
/we-adk/projects/<projectId>             Project overview: pipeline stage, folders, meetings
                 …/sketcher              Design files (folder tree + file list)
                 …/sketcher/board        Frames, and meeting notes → generated screens
                 …/builder               Work mockups, requirements spec, feature specs, tests, manuals
                 …/developer             Harness-based development console
/we-adk/canvas?screen=…&project=…        The shared block canvas editor
/we-adk/production                       Every screen captured from a live product, across projects
/we-adk/devadmin                         Token, usage and security operations
/we-adk/architecture                     How the four tools fit together
```

Tools live **inside** a project: a project walks from concept sketches (Sketcher) through a
spec and working screens (Builder) into development (Developer). DevAdmin is org-level.

## Data

Nothing is stored in the browser any more. Around eighty keys across fifteen areas — rounds,
tasks, canvases, generated screens, IA rows, QA runs, whiteboards, team workspaces — used to
live in `localStorage`; they are now rows in Postgres, reached through `/api/state`.

Two things stay local on purpose, and neither is data: the user's Claude credential and this
session's own token. The API refuses to store them and so does a check constraint on the
table.

### How, without rewriting the workspace

Those eighty keys are read from inside render paths, `useMemo` bodies and derivation
helpers that cannot await anything. Making each of them a promise would have meant
rewriting most of the workspace, so instead the storage moved and the shape did not:

```
hydrate once  →  answer synchronously from memory  →  flush changes in the background
```

`src/lib/api/workspace-store.ts` is a `localStorage`-shaped store — `getItem`, `setItem`,
`removeItem` — backed by the API. `WorkspaceProvider` fills it before the first render and
holds that render until it has. Waiting is the point: every screen treats "nothing stored"
as "nothing here yet", so rendering first would show a convincing empty workspace and the
next edit would save that over the real thing.

Writes are batched and sent together, retried when they fail, and flushed on unload. A save
that is not getting through says so in a banner rather than a toast, because an edit that is
not reaching the database is something the user needs to keep knowing about.

The first load after this change hands whatever a browser was still holding to the API. That
import fills gaps and never overwrites, so two people upgrading on the same day cannot
flatten each other, and the local copy is left where it was.

### One consequence, and one thing still to do

State that was private to a browser is now shared by the team, which is the point of a
backend but is a change in behaviour: two people open the same project and see the same
rounds. Genuine preferences stay per person — language, rail width, chosen chat model — and
`StateScope` on the API is the list of which those are. Anything unclassified is shared,
deliberately, because a key nobody thought about being visible to the team is noticed at
once and being private to one browser is not.

Still to do: projects exist in Postgres twice. The normalised `project` table behind
`/api/projects` is the real model, and the six demo projects are still hardcoded in
`src/lib/we-adk-mock/projects.ts` while the ones you create sit in `workspace_state` under
`we-adk:projects`. Seeding those six into the table and pointing the list at `/api/projects`
retires both. `toDesignProject` in `src/lib/api/projects.ts` already maps an API row onto the
shape the cards render, so that step is small. The same is true of the other areas: each can
be normalised out of `workspace_state` into its own table without the UI noticing.

## The API

The API is a separate service in [`backend/`](backend) — Spring Boot 3.5 on Java 21, Spring
MVC on virtual threads, JPA over Postgres with Flyway owning the schema, a JWT resource
server, `anthropic-java`, and Actuator with Micrometer. Its own README covers running it,
the schema, sign-in and the AI endpoints.

`NEXT_PUBLIC_API_BASE_URL` is where the browser reaches it. `API_INTERNAL_URL` is where
this server reaches it, which differs whenever the API answers on a container network name
the browser cannot resolve. Copy `.env.example` to `.env.local` to start.

### Signing in

There is a sign-in screen at `/login`, and it has no password field. That is deliberate: the
password is typed on the authorization server's own page, so this application never handles
one and cannot leak one. The screen starts the flow and says where it is going, because a
button that silently navigates away is worse than one that explains itself.

```
/login  →  API /login  →  /oauth2/authorize  →  /auth/callback  →  back where you were
```

Authorization code with PKCE, against the authorization server in `backend/`. Turn it on
with `SECURITY_MODE=oauth2` on the API and seed an account with `WEADK_AUTH_SEED_EMAIL` and
`WEADK_AUTH_SEED_PASSWORD`; the API's README covers the rest. With the API in `open` mode
there is no session to have, the workspace is fully usable, and the sign-out button hides
itself rather than sitting there doing nothing.

`NEXT_PUBLIC_OAUTH_CLIENT_ID` has to match `weadk.oauth2.client.id`, and that client's
registered redirect URI has to be this app's `/auth/callback`. A mismatch between those two
is the most common reason an OAuth2 flow fails, and the server refuses before the browser
ever reaches the callback — so the error shows up there rather than here.

An expired token is renewed without anybody noticing. There is no refresh token by design,
so renewal is a redirect through `/oauth2/authorize` that succeeds silently while the
session on the API is alive; it is attempted once per page load and then falls back to the
visible screen. `src/lib/api/oauth.ts` is that flow and `WorkspaceProvider` is what triggers
it, on a 401 from the state read.

### The API contract

The TypeScript client is typed from the API rather than alongside it:

```
Java controllers → /v3/api-docs → openapi/openapi.json → src/lib/api/schema.d.ts
```

```bash
pnpm api:export   # a running API → openapi/openapi.json
pnpm api:types    # openapi/openapi.json → src/lib/api/schema.d.ts
pnpm api:check    # regenerate and fail if either committed file has moved
```

Both generated files are committed, and CI re-exports the document from a freshly booted
API, regenerates the types and fails on any diff. This is worth the machinery: Java DTOs and
a hand-written TypeScript client can disagree without either side failing to compile, and
the mismatch surfaces at runtime as a field that is quietly `undefined`.

`src/lib/api/` is the client: `projects`, `meetings`, `requests` and `auth` call the API
directly; `ai` goes through the proxies below. `readApiError` flattens the API's RFC 9457
problem details to the single sentence the UI shows.

### Claude, and why the routes under `src/app/api/` are still there

The five AI routes no longer do the work — they forward to the API. They stay in place so
the browser keeps calling one origin: twelve call sites across the workspace post to
`/api/sketcher/…`, none of them need to know where the API lives, and no request from the
browser is subject to CORS.

| Route                          | Forwards to                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `POST /api/sketcher/ai`        | `/api/ai/canvas` — an instruction becomes canvas operations  |
| `POST /api/sketcher/generate`  | `/api/ai/generate` — meeting notes become screens            |
| `POST /api/sketcher/frd`       | `/api/ai/frd` — a PRD becomes functional requirements        |
| `POST /api/sketcher/chat`      | `/api/ai/chat` — the folder chat, streamed through untouched |
| `POST /api/claude-auth/verify` | `/api/ai/verify` — proves a credential works                 |

What each route still owns is the part that cannot move: the block catalogue, and the schema
that validates a canvas operation against it. Both are generated from the same modules the
canvas editor is drawn from, so they stay on this side and the catalogue travels to the API
with the request. Restating it in Java would be a second definition of what a block is.

`/api/prototype/[slug]` is unchanged and stays here for good reason: it renders one of this
app's own pages and hands back the markup, which is not something the API could do.

**A behaviour change to know about.** These routes used to run each user's own Claude Code
subscription by spawning the local `claude` CLI with a token from `claude setup-token`. A
server-side SDK cannot do that — a subscription OAuth token is not an API key — so the
default is now one API key on the API (`ANTHROPIC_API_KEY`). The "Connect your Claude
account" dialog still works and still sends what you paste, now as an API key; `sk-ant-oat…`
tokens are still accepted but an API key is the supported path. Every call writes an
`ai_usage` row, so what the AI costs is now a fact rather than a mock.

**No key on this machine?** The dev stack includes a `claude-bridge` service
(`scripts/claude-bridge.mjs`, built by `deploy/bridge.Dockerfile`): a small server that
answers the Messages API by running the `claude` CLI. The API is pointed at it through
`CLAUDE_BRIDGE_URL`, and while that is set **every** AI call goes through it — including one
carrying a key someone pasted into the Connect dialog, which the bridge hands to the CLI so
they still spend their own quota. A deployment sets no bridge URL and uses its
`ANTHROPIC_API_KEY` directly, unchanged. Usage rows are still written; their cost column is
list price, not what a subscription charges.

It needs a credential of its own, because a container cannot read the login on your Mac.
Run `claude setup-token`, copy `deploy/dev.secrets.env.example` to `deploy/dev.secrets.env`
and paste the token in as `CLAUDE_CODE_OAUTH_TOKEN`. Until you do, the AI features answer
with that instruction rather than failing obscurely. `pnpm claude-bridge` runs the same
script on the host instead, if you would rather use your own signed-in CLI directly.

## What came across

`src/components/ui/` holds only the design-system primitives these screens use,
copied from the monorepo's `@productflow/ui` (shadcn-style: Radix + Tailwind v4).
Left behind: the ProductFlow PLM app, the Nest API and its Prisma schema,
authentication, react-query, sockets, and the unit/e2e test setup.
