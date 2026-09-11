-- Delete stops removing rows.
--
-- Every delete endpoint used to run `deleteById` and let the foreign keys take the
-- rest with them. They now write `status = 0` instead, and every read asks for
-- `status = 1`, so a delete is recoverable and the row is still there to be
-- accounted for afterwards.
--
-- 1 is live, 0 is deleted. An integer rather than a boolean because that is the
-- flag the workspace asked for, and because a later state that is neither live nor
-- deleted then costs a value rather than a column.
--
-- Existing rows default to 1: nothing that survived until this migration was
-- deleted, so the default is the correct backfill and no update statement is needed.

alter table project add column status integer not null default 1;
alter table meeting add column status integer not null default 1;
alter table screen add column status integer not null default 1;
alter table screen_request add column status integer not null default 1;

alter table project add constraint project_status_valid check (status in (0, 1));
alter table meeting add constraint meeting_status_valid check (status in (0, 1));
alter table screen add constraint screen_status_valid check (status in (0, 1));
alter table screen_request add constraint request_status_valid check (status in (0, 1));

-- The live rows are what every query now asks for, so the indexes that serve those
-- queries are narrowed to them: a table that accumulates deleted rows should not
-- make its own reads slower, and a partial index keeps them off the leaves.
drop index meeting_project_idx;
create index meeting_project_live_idx
    on meeting (project_id, meeting_date desc) where status = 1;

drop index screen_meeting_idx;
create index screen_meeting_live_idx
    on screen (meeting_id, position) where status = 1;

drop index request_project_idx;
create index request_project_live_idx
    on screen_request (project_id, created_at desc) where status = 1;

drop index request_waiting_idx;
create index request_waiting_live_idx
    on screen_request (project_id) where version is null and status = 1;

-- A position is unique among the screens a meeting still has, not among every row
-- that has ever been in it. Reset leaves positions 0..n behind at status 0 and the
-- next generation starts again at 0, which the old table-wide constraint read as a
-- duplicate.
--
-- A partial unique index cannot be deferred, which the constraint it replaces was.
-- Nothing needs the deferral any more: `Meeting.replaceScreens` renumbers a
-- contiguous live set from 0, so a screen it keeps is assigned the position it
-- already had and no intermediate state collides.
alter table screen drop constraint screen_position_unique;
create unique index screen_position_live_idx
    on screen (meeting_id, position) where status = 1;
