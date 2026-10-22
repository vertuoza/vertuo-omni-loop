-- A runner job stopped mid-way (PRD 2375, docs: .omni-loop/delivery/inbox/2375-job-stopped-mid-way/spec.md):
-- a `/omni:yolo` or `/omni:yolo-fix` job that exits 0 with no hand-off line is not Done, it stopped
-- before it finished, and the Runners page says so with what it left merged.
--
-- - runner_jobs.outcome: also accepts `stopped` (the job ended with no hand-off line) and `human`
--   (the value the page's Need human state already writes, which the check refused until now).
--   Still null for every other job.
-- - runner_jobs.slices_merged, runner_jobs.slices_total: how many of the PRD's slices were merged out
--   of all of them when the job ended; both null when the runner could not read the board.
--   Both or neither, and 0 <= slices_merged <= slices_total.
--
-- runner_jobs keeps its table-wide grants and its row-level security: a member of the workspace reads
-- the columns with the row, and only the service role, through the routes, writes them.
--
-- Rollback: a follow-up migration, once no row uses `stopped` or `human`, restores the check to
-- ('answers', 'held', 'ready') and drops slices_merged and slices_total (and their check). Nothing
-- else reads them.

alter table public.runner_jobs drop constraint runner_jobs_outcome_check;
alter table public.runner_jobs add constraint runner_jobs_outcome_check
  check (outcome in ('answers', 'held', 'ready', 'human', 'stopped'));

alter table public.runner_jobs add column slices_merged integer;
alter table public.runner_jobs add column slices_total integer;
alter table public.runner_jobs add constraint runner_jobs_slices_check
  check ((slices_merged is null and slices_total is null) or coalesce(slices_merged between 0 and slices_total, false));

comment on column public.runner_jobs.slices_merged is
  'How many of the PRD''s slices were merged when the job ended (PRD 2375). Null when the runner could not read the board.';
comment on column public.runner_jobs.slices_total is
  'How many slices the PRD''s plan has (PRD 2375). Null when the runner could not read the board.';
