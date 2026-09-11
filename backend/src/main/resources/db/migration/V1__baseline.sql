-- WE-ADK baseline schema.
--
-- Ids are text, not generated: the workspace already names things
-- ("mini-pos-kickoff", "cust-m2f8x-0-a91c3"), those names are written into
-- stored pages and links, and renumbering them server-side would break every
-- reference that already exists.

create table project (
    id            text primary key,
    name          text        not null,
    customer      text        not null default '',
    owner         text        not null default '',
    summary       text        not null default '',
    stage         text        not null default 'Project Brief',
    status_label  text        not null default 'In progress',
    status_tone   text        not null default 'blue',
    accent        text        not null default 'blue',
    spend         numeric(12,2) not null default 0,
    -- An archived project is a Customer project: meetings, no rounds.
    archived      boolean     not null default false,
    solution      text,
    updated_at    timestamptz not null default now(),
    created_at    timestamptz not null default now()
);

create table meeting (
    id           text primary key,
    project_id   text        not null references project (id) on delete cascade,
    title        text        not null,
    meeting_date date        not null,
    attendees    text        not null default '',
    notes        text        not null default '',
    -- 'meeting-note' | 'wireframe'
    kind         text        not null default 'meeting-note',
    -- 'meeting' | 'feedback' | 'suggestion'
    source       text        not null default 'meeting',
    posted_by    text,

    -- The product these screens are built to fit, chosen before generating.
    product_id   text references project (id) on delete set null,
    product_name text,
    -- The product they have actually been sent to. A plan is not a fact, so
    -- these are two columns rather than one.
    moved_to_id  text references project (id) on delete set null,
    moved_to_name text,

    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    constraint meeting_kind_valid check (kind in ('meeting-note', 'wireframe')),
    constraint meeting_source_valid check (source in ('meeting', 'feedback', 'suggestion'))
);

create index meeting_project_idx on meeting (project_id, meeting_date desc);

create table screen (
    id          text primary key,
    meeting_id  text        not null references meeting (id) on delete cascade,
    -- Explicit, because the order screens are met in is part of the product.
    position    integer     not null,
    name        text        not null,
    html        text        not null default '',

    -- Where it sits: the screen it opens from, and what kind of surface it is.
    parent_id   text references screen (id) on delete set null,
    screen_type text        not null default 'Screen',
    platform    text        not null default 'PC',

    -- N / M in the tree comes from these two, not from a diff of the html.
    updated_at  timestamptz,
    moved_at    timestamptz,

    constraint screen_type_valid check (screen_type in ('Screen', 'Popup', 'Drawer')),
    constraint screen_platform_valid check (platform in ('PC', 'Mobile')),
    constraint screen_not_own_parent check (parent_id is null or parent_id <> id),
    constraint screen_position_unique unique (meeting_id, position) deferrable initially deferred
);

create index screen_meeting_idx on screen (meeting_id, position);

-- A screen moved into a product and waiting for a round: the Request tab.
create table screen_request (
    id            text primary key,
    project_id    text        not null references project (id) on delete cascade,
    name          text        not null,
    route         text,
    -- "From Fleet management portal", or "[TASK-12] Approval rework".
    from_label    text        not null default '',

    -- The IA agreed at the move. Kept as the path it was agreed at rather than
    -- a foreign key: the parent may not exist in this product yet.
    parent_path       jsonb   not null default '[]'::jsonb,
    parent_name       text    not null default 'Top level',
    screen_type       text    not null default 'Screen',
    platform          text    not null default 'PC',

    -- Set when it is filed into a round; null while it is still waiting.
    version       integer,
    created_at    timestamptz not null default now(),
    moved_at      timestamptz,

    constraint request_type_valid check (screen_type in ('Screen', 'Popup', 'Drawer')),
    constraint request_platform_valid check (platform in ('PC', 'Mobile'))
);

create index request_project_idx on screen_request (project_id, created_at desc);
create index request_waiting_idx on screen_request (project_id) where version is null;
