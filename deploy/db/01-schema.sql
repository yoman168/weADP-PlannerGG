-- WE-ADK schema, modelled on the mock modules in src/lib/we-adk-mock/.
--
-- Runs once, on an empty data volume, via the postgres image's
-- /docker-entrypoint-initdb.d hook. To re-run it: `docker compose down -v`.
--
-- Scope: the durable domain — projects, the meetings under them, the design
-- files those produce, and the task board. Deliberately NOT modelled are the
-- purely presentational types (CHIP_CLASSES, ButtonVariant, BlockProps
-- catalogues, IADepthConfig): those are UI vocabulary that belongs in the
-- bundle, not in rows.
--
-- The app does not read from this yet. Every screen still renders from the mock
-- modules and localStorage; this is the target shape for that migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- Vocabularies. Native enums rather than CHECK constraints so the values are
-- discoverable in a client — DBeaver lists them under Data types.
-- ---------------------------------------------------------------------------

-- types.ts: ChipTone
CREATE TYPE chip_tone AS ENUM ('neutral', 'blue', 'amber', 'green', 'red', 'slate', 'violet');

-- types.ts: VersionStatus
CREATE TYPE version_status AS ENUM ('Released', 'In progress');

-- projects.ts: PROJECT_STAGES
CREATE TYPE project_stage AS ENUM ('Project Brief', 'Summary', 'Design', 'Prototype');

-- projects.ts: ProjectAccent
CREATE TYPE project_accent AS ENUM ('indigo', 'violet', 'green', 'teal', 'amber', 'slate');

-- production-screens.ts: SOLUTIONS
CREATE TYPE solution_name AS ENUM ('Cloud', 'HD Korea Shipbuilding', 'Harim');

-- projects.ts: DesignFolder.kind
CREATE TYPE folder_kind AS ENUM ('concept', 'real', 'design', 'version', 'group');

-- sketches.ts: SketchScreen.origin
CREATE TYPE screen_origin AS ENUM ('generated', 'copied', 'blank');

-- tasks.ts: TaskStatus
CREATE TYPE task_status AS ENUM ('Complete', 'Request', 'Progress', 'Feedback');

-- tasks.ts: TaskCategory
CREATE TYPE task_category AS ENUM (
  'Research', 'Design', 'Development', 'Testing', 'Documentation', 'Other'
);

-- ---------------------------------------------------------------------------
-- Projects. Ids are the mock's own slugs ('proj-eacc-cloud'), not serials, so
-- existing seed data and localStorage keys keep working through the migration.
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  customer      text NOT NULL,
  owner         text NOT NULL,
  summary       text NOT NULL DEFAULT '',
  stage         project_stage NOT NULL,
  accent        project_accent NOT NULL,
  -- DesignProject.status is a Chip: a label plus the tone it renders in.
  status_label  text NOT NULL,
  status_tone   chip_tone NOT NULL DEFAULT 'neutral',
  -- Claude spend so far, in USD. numeric, not float — this is money.
  spend         numeric(12, 2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  -- True once the current stage's output is committed to GitLab.
  saved         boolean NOT NULL DEFAULT false,
  archived      boolean NOT NULL DEFAULT false,
  -- Live solution whose captured screens fill this project's real-screens folder.
  solution      solution_name,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_archived_updated_idx ON projects (archived, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Meetings. One concept folder per customer meeting; `notes` is the 회의록 that
-- screen generation reads.
-- ---------------------------------------------------------------------------

CREATE TABLE sessions (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title           text NOT NULL,
  attendees       text NOT NULL DEFAULT '',
  notes           text NOT NULL DEFAULT '',
  kind            text,
  met_at          timestamptz NOT NULL,
  -- Minutes in the room — planners use it to judge how firm the notes are.
  duration_min    integer CHECK (duration_min IS NULL OR duration_min > 0),
  -- Settled in this meeting; safe to design against.
  decisions       text[] NOT NULL DEFAULT '{}',
  -- Raised and left open; a design here is a guess until they answer.
  open_questions  text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_project_idx ON sessions (project_id, met_at DESC);

-- ---------------------------------------------------------------------------
-- Folder tree. Self-referencing: a version folder can hold group folders.
-- ---------------------------------------------------------------------------

CREATE TABLE folders (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  parent_id       text REFERENCES folders (id) ON DELETE CASCADE,
  name            text NOT NULL,
  label           text NOT NULL,
  kind            folder_kind NOT NULL,
  -- Concept folders point at the meeting whose notes fill them.
  session_id      text REFERENCES sessions (id) ON DELETE SET NULL,
  -- Version folders only: 1 is the baseline, later numbers are iterations.
  version_number  integer CHECK (version_number IS NULL OR version_number >= 1),
  version_status  version_status,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- A folder cannot be its own parent.
  CONSTRAINT folders_no_self_parent CHECK (parent_id IS DISTINCT FROM id)
);

CREATE INDEX folders_project_idx ON folders (project_id);
CREATE INDEX folders_parent_idx ON folders (parent_id);

-- ---------------------------------------------------------------------------
-- Design files — the canvases the editor opens.
-- ---------------------------------------------------------------------------

CREATE TABLE design_files (
  id               text PRIMARY KEY,
  project_id       text NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  folder_id        text NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
  -- Concept folders only — the meeting that owns the file.
  session_id       text REFERENCES sessions (id) ON DELETE SET NULL,
  -- As it reads in the list, e.g. 'loan-product-comparison.design'.
  file_name        text NOT NULL,
  name             text NOT NULL,
  route            text,
  seed_pattern     text NOT NULL,
  kind             text NOT NULL,
  status_label     text NOT NULL,
  status_tone      chip_tone NOT NULL DEFAULT 'neutral',
  -- Name of the design this one is an alternative of.
  variant_of_name  text,
  -- Live route this design was copied from or revises.
  based_on_route   text,
  -- Files the user created can be deleted; seeded ones cannot.
  removable        boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX design_files_folder_idx ON design_files (folder_id);
CREATE INDEX design_files_project_updated_idx ON design_files (project_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Canvas contents. A screen is a flat, ordered list of blocks — `ordinal` is
-- that order, and it is what the AI edit operations reorder.
-- ---------------------------------------------------------------------------

CREATE TABLE canvas_blocks (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  design_file_id  text NOT NULL REFERENCES design_files (id) ON DELETE CASCADE,
  -- The block id as the editor knows it, unique within its canvas.
  block_id        text NOT NULL,
  ordinal         integer NOT NULL CHECK (ordinal >= 0),
  kind            text NOT NULL,
  -- Layer name, renameable independently of the visible label.
  name            text NOT NULL,
  hidden          boolean NOT NULL DEFAULT false,
  -- BlockProps is a per-kind union; jsonb keeps it without a table per block kind.
  props           jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (design_file_id, block_id),
  UNIQUE (design_file_id, ordinal) DEFERRABLE INITIALLY DEFERRED
);

-- ---------------------------------------------------------------------------
-- Concept screens on the board, before they become design files.
-- ---------------------------------------------------------------------------

CREATE TABLE sketch_screens (
  id              text PRIMARY KEY,
  session_id      text NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  name            text NOT NULL,
  route           text,
  seed_pattern    text NOT NULL,
  status_label    text NOT NULL,
  status_tone     chip_tone NOT NULL DEFAULT 'neutral',
  -- Set when this screen is an alternative of another.
  variant_of      text,
  -- How this screen got here; NULL for seeded ones.
  origin          screen_origin,
  -- For copies and revisions of live screens: the real route it started from.
  based_on_route  text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sketch_screens_session_idx ON sketch_screens (session_id);

-- ---------------------------------------------------------------------------
-- Screens captured from a live product, across projects.
-- ---------------------------------------------------------------------------

CREATE TABLE production_screens (
  id            text PRIMARY KEY,
  solution      solution_name NOT NULL,
  -- Menu path as users see it.
  path          text NOT NULL,
  route         text NOT NULL,
  seed_pattern  text NOT NULL,
  status_label  text NOT NULL,
  status_tone   chip_tone NOT NULL DEFAULT 'neutral',
  -- Indented under its parent menu in the list.
  nested        boolean NOT NULL DEFAULT false,
  captured_at   timestamptz NOT NULL,
  UNIQUE (solution, route)
);

CREATE INDEX production_screens_solution_idx ON production_screens (solution, path);

-- ---------------------------------------------------------------------------
-- Task board. Rounds ("version") are the same numbering the design rounds use.
-- ---------------------------------------------------------------------------

CREATE TABLE tasks (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  -- Short code shown in brackets, e.g. 'F2_09', 'AB1'.
  code         text NOT NULL,
  title        text NOT NULL,
  description  text,
  status       task_status NOT NULL DEFAULT 'Request',
  category     task_category,
  assignee     text NOT NULL,
  -- Who verifies it. NULL means the question has not been answered yet.
  tested_by    text,
  -- The human tester, deliberately a different question from `assignee`.
  tester       text,
  -- 1 = highest, 3 = lowest.
  priority     smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  -- Optional count shown in parentheses after the title.
  count        integer CHECK (count IS NULL OR count >= 0),
  tags         text[] NOT NULL DEFAULT '{}',
  -- NULL means unscheduled: raised, but not yet put in a round.
  version      integer CHECK (version IS NULL OR version >= 1),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, code)
);

CREATE INDEX tasks_project_status_idx ON tasks (project_id, status);
CREATE INDEX tasks_project_version_idx ON tasks (project_id, version);

CREATE TABLE task_comments (
  id           text PRIMARY KEY,
  task_id      text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  kind         text NOT NULL,
  -- Display name, as it is shown on the entry.
  author       text NOT NULL,
  text         text NOT NULL,
  pinned       boolean NOT NULL DEFAULT false,
  -- Who liked it; the reader goes in and out as the button is pressed.
  likes        text[] NOT NULL DEFAULT '{}',
  -- Names only, like the chat keeps them.
  attachments  text[] NOT NULL DEFAULT '{}',
  at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_comments_task_idx ON task_comments (task_id, at);

-- ---------------------------------------------------------------------------
-- Activity feed. `text` arrives already in the reader's language, so there is
-- no message key to translate at render time.
-- ---------------------------------------------------------------------------

CREATE TABLE activity_events (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  -- The round it happened in, when it happened in one.
  version     integer CHECK (version IS NULL OR version >= 1),
  text        text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_events_project_idx ON activity_events (project_id, at DESC);

COMMIT;
