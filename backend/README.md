# WE-ADK API

The service behind the workspace: projects, meetings and the screens they produce, the
requests those screens become, sign-in, and the Claude calls Sketcher makes.

Spring Boot 3.5 on Java 21. Spring MVC on virtual threads, Spring Data JPA over Postgres
with Flyway owning the schema, a stateless JWT resource server, `anthropic-java` behind the
AI endpoints, and Actuator with a Prometheus registry.

```bash
# From the repository root. Brings up Postgres, this service and the workspace together.
pnpm stack:dev            # api on 8080
pnpm stack:prod           # api on 8180, alongside

# Or on its own, against a Postgres you already have:
export JAVA_HOME=/opt/homebrew/opt/openjdk@21   # no linked system JDK on stock macOS
DB_URL=jdbc:postgresql://localhost:5433/weadk ./mvnw spring-boot:run
```

`./mvnw verify` runs the tests. They need a Docker daemon and `JAVA_HOME` — the ones that
matter boot the whole context against a real Postgres of their own, because that is the only
way to catch an entity that disagrees with its table. They are independent of the compose
stack, so they pass whether or not it is running, but Docker itself has to be up.

## Layout

| Package                         | What is in it                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `project`, `meeting`, `request` | The domain: products and customer projects, meetings and their screens, screens waiting for a round |
| `state`                         | Workspace state, the eighty-odd keys the browser used to keep                                       |
| `auth`                          | Sign-in, the user table, and the token this service signs                                           |
| `ai`                            | The Claude calls, and the record of what each one cost                                              |
| `common`                        | Shared enums, ids, and the one error handler                                                        |
| `config`                        | Security, the OpenAPI document, and bound properties                                                |

## The schema is Flyway's

`spring.jpa.hibernate.ddl-auto` is `validate`. Hibernate never changes the database; it
checks that its mappings match what the migrations built and refuses to start when they do
not. Schema changes go in a new `V*__*.sql` under `src/main/resources/db/migration`.

Ids are `text` and supplied by the client wherever the workspace already named something.
A screen's id is written into stored pages and into the links between them, so a server
that renumbered them would break every reference that already exists.

## Workspace state

`workspace_state` holds what the browser used to keep in `localStorage`: rounds, tasks,
canvases, generated screens, IA rows, QA runs, whiteboards. Around eighty keys across
fifteen areas, and modelling each properly is a long job — this is the table that let the
browser stop being the database, and lets those areas be normalised out of it one at a time.

| Route                    | What it does                                    |
| ------------------------ | ----------------------------------------------- |
| `GET /api/state`         | Everything the caller can see, as one map       |
| `PUT /api/state`         | A batch of writes; a null value deletes the key |
| `POST /api/state/import` | Fills only the keys that do not exist yet       |

A value is stored as the exact string the browser sent. `text`, not `jsonb`, because some
values are JSON and some are a bare number, and the code that reads them back does its own
parsing — re-encoding would reformat the first kind and reject the second.

`owner` is `*` for state the team shares or a user id for one person's preferences, and
`StateScope` decides which a key is. Shared is the default: a key nobody classified being
visible to the team is noticed immediately, while one silently private to a browser is not.
Credentials are refused by that class and by a check constraint on the table.

`POST /api/state/import` exists for one moment in this system's life. Before the migration
every browser was the database, so the first load afterwards has to move that state up
rather than appear to have lost it. It fills gaps and never overwrites, so whichever browser
reconnects first cannot flatten work done from another.

## Errors

One shape, RFC 9457 problem details:

```json
{
  "type": "https://we-adk.dev/problems/not-found",
  "title": "Not found",
  "status": 404,
  "detail": "Project proj-x not found"
}
```

The sentence to show a user is `detail`. `common/ApiExceptionHandler` covers the general
cases; sign-in and the AI endpoints add their own handlers for the failures particular to
them, in this same shape, so a client still has one format to read.

## Authentication

`weadk.security.mode` picks one of three, and they are alternatives rather than layers:

| Mode             | `/api/**`       | Where a token comes from                                       |
| ---------------- | --------------- | -------------------------------------------------------------- |
| `open` (default) | unauthenticated | nowhere; for local work and CI                                 |
| `jwt`            | bearer token    | `POST /api/auth/login`, HS256, or an external issuer           |
| `oauth2`         | bearer token    | this service: a sign-in page, authorization code + PKCE, RS256 |

In every mode the docs, health and Prometheus endpoints stay open, because a probe has no
token to offer.

### `oauth2` — the real one

```bash
SECURITY_MODE=oauth2 \
WEADK_AUTH_SEED_EMAIL=you@example.com WEADK_AUTH_SEED_PASSWORD=… \
  ./mvnw spring-boot:run
```

This service becomes the authorization server. A person signs in at `/login`, which is
served here and nowhere else — that is what the redirect buys, and why the workspace's own
sign-in screen has no password field. The workspace is registered as a public client with
no secret, because a browser application cannot keep one, and PKCE is required rather than
merely allowed: without it an intercepted authorization code could be redeemed by anyone.

Two decisions worth knowing before they surprise you.

**There is no refresh token.** Spring will not issue one to a public client on this grant,
and it is right not to: a refresh token is a long-lived credential and browser storage is
readable by any injected script. Renewal instead goes back through `/oauth2/authorize` with
`prompt=none`, where the long-lived credential is an http-only session cookie no script can
read. An expired access token therefore costs a redirect the user does not see. What that
rests on is the session, so `server.servlet.session.timeout` is what decides how long a
working day goes without a password — twelve hours by default. Sessions are in memory, so a
restart does sign everyone out; a clustered deployment wants Spring Session on this database.

**The signing key lives in `oauth2_signing_key`.** Generating one at startup is the usual
shortcut and it invalidates every token that was issued before the restart, which reads to a
user as being signed out at random. It is generated once and read back afterwards. Rotation
is deliberate: delete the row, restart, and everyone signs in again.

`POST /api/auth/login` answers 501 in this mode — not 401, because the credentials were
never the problem and a 401 would send someone off to check a password that was fine.

The whole flow is exercised end to end by a script, which is where it belongs: the
interesting parts are a real cookie jar and a real redirect, neither of which MockMvc has.

```bash
AS_URL=http://localhost:8080 AS_EMAIL=you@example.com AS_PASSWORD=… \
  node ../scripts/oauth/flow-check.mjs
```

### `jwt` — a token endpoint for scripts

Set `weadk.auth.jwt.secret` to at least 32 bytes and this service signs its own HS256
tokens. Non-standard, and useful: a script or a test wants one call, not a redirect.

```bash
curl -sX POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"…"}'
# → { "token": "eyJ…", "expiresAt": "…", "user": { … } }

curl -s localhost:8080/api/auth/me -H "Authorization: Bearer $TOKEN"
```

With the secret unset it verifies tokens from the issuer configured under
`spring.security.oauth2.resourceserver.*` and issues none of its own.

### The first account

`weadk.auth.seed.email` and `.password` create one, once, only when the user table is
empty — so a redeploy cannot reset a password that has since been changed.

## The AI endpoints

| Route                   | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `GET /api/ai/status`    | Whether a credential is configured, and which model each alias means |
| `POST /api/ai/verify`   | One tiny Haiku turn, to prove a credential works                     |
| `POST /api/ai/canvas`   | An instruction becomes canvas operations                             |
| `POST /api/ai/generate` | Meeting notes become proposed screens                                |
| `POST /api/ai/frd`      | A product requirement becomes functional requirements                |
| `POST /api/ai/chat`     | One turn of the folder chat, streamed as newline-delimited JSON      |

`weadk.anthropic.api-key` is the credential. Unset, these endpoints answer 503 with a
sentence saying so rather than failing somewhere further in. A caller can override it per
request with an `X-Anthropic-Api-Key` header, which is how someone spends their own quota
instead of the organisation's.

**What changed, and it is a product change rather than a refactor.** The workspace used to
run each user's own Claude Code subscription by shelling out to the local `claude` CLI with
a token from `claude setup-token`. A server-side SDK cannot do that — a subscription OAuth
token is not an API key. Tokens shaped like one (`sk-ant-oat…`) are still accepted and sent
as a bearer token with the OAuth beta header, but an API key is the supported path, and the
default is now one key for the deployment. That is also what makes the DevAdmin usage
screens addable up: every call writes an `ai_usage` row with its tokens, its cost at the
day's rates, and its outcome.

### Two things the model call deliberately does not know about

**The block catalogue stays in the browser.** What a block is, and which props it has, is
generated from the TypeScript module the canvas inspector is drawn from. It travels to this
service with the request and is used in the prompt; the operations that come back are
returned as the model wrote them and validated against the catalogue on the client.
Restating that catalogue in Java would be a second definition of what a block is, drifting
out of step with the first — the same failure the generated client types exist to prevent.

**Haiku takes neither adaptive thinking nor an effort level.** Both are a 400 from the API,
not a warning, and the folder chat defaults to Haiku. `ModelCapabilities` decides per
model, and errs towards leaving a knob off.

### The chat stream

Newline-delimited JSON, in the envelope shape the CLI emitted, because six panels in the
workspace decode it through one function — `readChatEvent` in
`src/components/we-adk/claude-chat.tsx`:

```
{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"…"}}}
{"type":"result","subtype":"success","usage":{"input_tokens":1200,"output_tokens":340},"total_cost_usd":0.0042,"duration_ms":8500}
{"type":"bridge_error","error":"…"}
```

`ChatEnvelopes` is the only place those shapes are built, and `ChatEnvelopesTest` pins the
field names. That decoder ignores anything it does not recognise, so a renamed field would
not throw — the chat would just stop showing replies.

## The contract

springdoc serves the OpenAPI document at `/v3/api-docs`, and the workspace's TypeScript
client types are generated from it. Both the exported document and the generated types are
committed, and CI re-exports and regenerates them to fail a build where either has fallen
behind. See the repository root README.

## Seeing the database

```bash
docker exec -it weadk-dev-postgres-1 psql -U weadk -d weadk
```

Or in a browser, which is the same thing Swagger UI is for the API:

```bash
pnpm stack:dev:tools      # http://localhost:8090
pnpm stack:prod:tools     # http://localhost:8190
```

It is behind a compose profile because it is a development tool — an unauthenticated door in
front of Postgres has no business starting as part of a normal `up` — and its port is bound
to loopback so it is not reachable from the network.

|             | dev                  | prod                 |
| ----------- | -------------------- | -------------------- |
| host / port | `localhost` / `5433` | `localhost` / `5434` |
| database    | `weadk`              | `weadk`              |
| credentials | `weadk` / `weadk`    | in `deploy/prod.env` |

The two stacks have separate volumes, so these are two different databases. Deleting one
does not touch the other, which is the point of running them side by side.

The interesting table is `workspace_state`: everything the workspace used to keep in the
browser. `select state_key, length(value) from workspace_state order by 2 desc;` is the
quickest look at what a project is carrying.

## Operations

`/actuator/health` (with `liveness` and `readiness` groups), `/actuator/info` and
`/actuator/prometheus` are open; the rest of Actuator needs the `ADMIN` role. Metrics carry
an `application` tag.
