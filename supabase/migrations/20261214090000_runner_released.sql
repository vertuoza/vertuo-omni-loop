-- A job's released claims (PRD 2175, docs: .omni-loop/delivery/inbox/2175-runner-dead-claims/spec.md,
-- sections 2 and 6): when a runner job ends while it holds claims, the runner releases them with `gh`
-- (`omni:in-progress` off, `omni:released` on, a comment on each sub-PR) and its last report says which.
--
-- - runner_jobs.released: the numbers of the sub-PRs the runner released, at most 50; null for a job
--   whose runner reported none (a runner from before this PRD, or a job that held no claim).
-- - runner_jobs.release_error: why the release failed, at most 200 characters; null when nothing did.
--
-- runner_jobs keeps its table-wide grants and its row-level security: a member of the workspace reads
-- both columns with the row, and only the service role, through the routes, writes them.
--
-- Rollback: a follow-up migration drops both columns. Nothing else reads them.

alter table public.runner_jobs add column released integer[];
alter table public.runner_jobs add column release_error text;

comment on column public.runner_jobs.released is
  'The sub-PRs the job''s runner released once the job ended (PRD 2175), as their numbers. Null when its report named none.';
comment on column public.runner_jobs.release_error is
  'Why the job''s runner could not release its claims (PRD 2175), at most 200 characters. Null when nothing failed.';
