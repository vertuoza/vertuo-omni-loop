-- A runner job's outcome (PRD 2223, docs: .omni-loop/delivery/inbox/2223-outbox-waiting/spec.md): a
-- `/omni:yolo` or `/omni:yolo-fix` job that ends with exit 0 says what its hand-off ended on, so the
-- Runners page can read Waiting on answers, Held or Ready instead of Done.
--
-- - runner_jobs.outcome: `answers` (the run ended on `/omni:yolo-fix <n>`), `held` (`/omni:yolo <n>`)
--   or `ready` (`/omni:pr-care <n>`); null for every other job, a failed, cancelled or timed-out one,
--   and a job whose runner is from before this PRD. The job's status stays `done`.
--
-- runner_jobs keeps its table-wide grants and its row-level security: a member of the workspace reads
-- the column with the row, and only the service role, through the routes, writes it.
--
-- Rollback: a follow-up migration drops the column. Nothing else reads it.

alter table public.runner_jobs add column outcome text
  constraint runner_jobs_outcome_check check (outcome in ('answers', 'held', 'ready'));

comment on column public.runner_jobs.outcome is
  'What a done yolo job''s hand-off ended on (PRD 2223): answers, held or ready. Null for any other job.';
