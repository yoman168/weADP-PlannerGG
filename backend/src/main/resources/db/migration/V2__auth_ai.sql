-- Sign-in, and what the AI has cost.
--
-- Two things V1 left out: who is allowed to call this API, and a record of every
-- Claude call it makes. The second is not bookkeeping for its own sake — the
-- DevAdmin screens are drawn from token counts and cost per group, and until
-- something writes these rows those screens have nothing real to read.
--
-- Text ids throughout, like V1: the client names what it already named.

create table app_user (
    id            text primary key,
    email         text        not null,
    -- BCrypt. Null for an account that exists but signs in through an external
    -- issuer, where this service never sees a password.
    password_hash text,
    name          text        not null default '',
    -- Free text, matched against team member names in the workspace.
    department    text,
    -- ROLE_ prefixes are added by the resource server, not stored here.
    -- jsonb rather than text[]: it is the array mapping the rest of this
    -- schema already uses, and `ddl-auto: validate` agrees with it.
    roles         jsonb       not null default '["USER"]'::jsonb,
    -- The group DevAdmin totals usage by.
    usage_group   text,
    disabled      boolean     not null default false,
    last_login_at timestamptz,
    created_at    timestamptz not null default now(),

    constraint app_user_email_unique unique (email),
    constraint app_user_email_lower check (email = lower(email)),
    constraint app_user_roles_present check (jsonb_array_length(roles) > 0)
);

-- One row per Claude call, successful or not.
--
-- `project_id` and `user_id` are nullable on purpose and deliberately not
-- cascading deletes: a cost that has been incurred does not stop having been
-- incurred because the project it was spent on was deleted, so the reference
-- is dropped and the row stays.
create table ai_usage (
    id             bigserial primary key,
    -- 'canvas' | 'generate' | 'frd' | 'chat' | 'verify'
    endpoint       text        not null,
    model          text        not null,
    user_id        text references app_user (id) on delete set null,
    project_id     text references project (id) on delete set null,
    -- What the caller was looking at, for reading a bill back to a screen.
    label          text,
    input_tokens   bigint      not null default 0,
    output_tokens  bigint      not null default 0,
    cache_read_tokens     bigint not null default 0,
    cache_write_tokens    bigint not null default 0,
    -- Derived from the token counts and the configured per-model rates, so a
    -- later price change cannot silently rewrite what history cost.
    cost_usd       numeric(12,6) not null default 0,
    duration_ms    bigint      not null default 0,
    -- 'ok' | 'refusal' | 'error'
    outcome        text        not null default 'ok',
    -- Present when outcome is not 'ok'.
    detail         text,
    at             timestamptz not null default now(),

    constraint ai_usage_endpoint_valid check (endpoint in ('canvas', 'generate', 'frd', 'chat', 'verify')),
    constraint ai_usage_outcome_valid check (outcome in ('ok', 'refusal', 'error'))
);

create index ai_usage_at_idx on ai_usage (at desc);
create index ai_usage_project_idx on ai_usage (project_id, at desc);
create index ai_usage_user_idx on ai_usage (user_id, at desc);
