-- A job's tokens (PRD 2102, docs: .omni-loop/delivery/inbox/2102-runner-health/spec.md, sections 4 and 5):
-- the runner counts the tokens a job's Claude transcripts hold (its worktree and every folder below it,
-- sub-agents included) and sends the four counts, numbers only, with each job report.
--
-- - runner_jobs.tokens: the last counts the runner reported, {input, output, cacheRead, cacheWrite};
--   null for a job whose runner never reported them (a runner from before this PRD, or a count it could
--   not read).
--
-- runner_jobs keeps its table-wide grants and its row-level security: a member of the workspace reads
-- the column with the row, and only the service role, through the routes, writes it. The machine's
-- tokens need no column: they ride in runners.health and in runner_samples.tokens_5h, which the
-- previous migration (20261211100000_runner_health.sql) added.
--
-- Proved by supabase/checks/runner_samples.sql.
-- Rollback: a follow-up migration drops runner_jobs.tokens. Nothing else reads it.

alter table public.runner_jobs add column tokens jsonb;

comment on column public.runner_jobs.tokens is
  'The tokens the job''s transcripts hold (PRD 2102): {input, output, cacheRead, cacheWrite}, numbers only, as its runner last reported them. Null when it never did.';
