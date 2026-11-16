-- The keys a GitHub webhook matches a snapshot on, as columns of their own (#2970): every webhook reads
-- the snapshots of the workspace's dossiers in the repository it names (apps/galaxy/src/touched/store.ts)
-- and keeps those the touch names, by the PRD's number, its issue's, or one of its pull requests'. That
-- read selected each row's whole summary (about 1 MB for a busy repository: 170 rows, up to 60 kB each)
-- to look at four numbers in it: after #2952, still the top consumer of the production database's time,
-- ~38 ms a call, 28%.
--
-- - prd: the summary's PRD number.
-- - issue: the number of the issue the summary read; null when it read none or could not read it.
-- - pulls: the numbers of the phase-0, feature and retro pull requests the summary holds, those it read.
--
-- Each is generated from the summary by the database and stored, so no writer sets it and it can never
-- disagree with the summary; a part that is not a number (null, or 'unread' when GitHub could not be
-- read) gives null, and is left out of pulls. The read selects these columns, never the summary, so no
-- summary is detoasted or sent. No index: the read already narrows to one repository through
-- dossier_github_workspace_repo_idx, and matches the few hundred rows it gets on these columns.
--
-- Adding stored generated columns rewrites the table once (~800 rows in production).
--
-- Rollback: a follow-up migration drops the three columns, once the read selects the summary again;
-- nothing else reads them.

alter table public.dossier_github
  add column prd integer generated always as (
    case when jsonb_typeof(summary -> 'prd') = 'number' then (summary -> 'prd')::integer end) stored,
  add column issue integer generated always as (
    case when jsonb_typeof(summary -> 'issue' -> 'number') = 'number' then (summary -> 'issue' -> 'number')::integer end) stored,
  add column pulls integer[] not null generated always as (array_remove(array[
    case when jsonb_typeof(summary -> 'phase0' -> 'number') = 'number' then (summary -> 'phase0' -> 'number')::integer end,
    case when jsonb_typeof(summary -> 'feature' -> 'number') = 'number' then (summary -> 'feature' -> 'number')::integer end,
    case when jsonb_typeof(summary -> 'retro' -> 'number') = 'number' then (summary -> 'retro' -> 'number')::integer end
  ], null)) stored;

comment on column public.dossier_github.prd is
  'The summary''s PRD number, generated from summary and stored, for the touch''s match.';
comment on column public.dossier_github.issue is
  'The number of the issue the summary read (null when none or unread), generated from summary and stored, for the touch''s match.';
comment on column public.dossier_github.pulls is
  'The numbers of the phase-0, feature and retro pull requests the summary read, generated from summary and stored, for the touch''s match.';
