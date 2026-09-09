-- Where the workspace's own state lives, now that it is not the browser.
--
-- Everything the workspace kept in localStorage — rounds, tasks, canvases, QA runs,
-- generated screens, IA rows, whiteboards — moves here. Around eighty keys across fifteen
-- areas, and modelling each of them properly is a long job; this is the table that lets
-- the browser stop being the database today, and lets those areas be normalised out of it
-- one at a time afterwards.
--
-- A key holds the same string the browser stored, byte for byte. Deliberately `text` and
-- not `jsonb`: some values are JSON, some are a bare number, and the code that reads them
-- back does its own parsing. Re-encoding through jsonb would reformat the JSON ones and
-- reject the rest.
create table workspace_state (
    -- '*' for state the whole team shares, or a user id for one person's preferences.
    -- Two rows can therefore hold the same key with different owners, which is the point:
    -- a round belongs to the project, a chosen locale belongs to a person.
    owner      text not null,
    state_key  text not null,
    value      text not null,
    updated_at timestamptz not null default now(),

    primary key (owner, state_key),

    -- Credentials have no business here. The browser holds the user's Claude key and their
    -- own session token and neither is ever sent; this is the second half of that, so a
    -- future caller cannot park one in the shared row by accident.
    constraint workspace_state_no_credentials check (
        state_key not in ('we-adk:claude-token', 'we-adk:api-token', 'we-adk:api-user')
    ),
    constraint workspace_state_key_shape check (state_key <> '' and length(state_key) <= 400)
);

-- The hydrate query: everything this viewer can see, in one read.
create index workspace_state_owner_idx on workspace_state (owner);
