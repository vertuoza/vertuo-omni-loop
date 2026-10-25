-- What the database keeps of the problems a bug fix saw and did not fix (PRD 2508, docs:
-- .omni-loop/delivery/inbox/2508-bug-fix-follow-ups/spec.md, section 3): /omni:bug-fix and
-- /omni:mega-bug-fix end their hand-off on one `Follow-up:` line per such problem, the runner reads them,
-- and the job keeps them so the app that sent it can offer a fix on each.
--
-- - runner_jobs.follow_ups: a list of at most five entries, `[]` for a job with none, a job of another
--   skill and a job a runner on an older kit reported. Each entry is `{repos, summary}`; the routes check
--   its shape (PRD 2508, runners.contract.ts), the database checks that it is a list of five at most,
--   named after runner_jobs.prs.
--
-- runner_jobs keeps its grants and its row-level security: a member of the workspace reads the new column
-- with the row (BR-PRODUCT-63: a key still reads its own workspace's jobs only), anyone else reads nothing,
-- and nobody signed in writes it; only the service role, through the routes, does.
--
-- Proven by supabase/checks/bug_fix_follow_ups.sql.
-- Rollback: a follow-up migration drops runner_jobs.follow_ups. The routes and the lines the logs hold stay
-- as they are.

alter table public.runner_jobs
  add column follow_ups jsonb not null default '[]'
    check (jsonb_typeof(follow_ups) = 'array' and jsonb_array_length(follow_ups) <= 5);

comment on column public.runner_jobs.follow_ups is
  'The problems a bug fix or a mega bug fix saw and did not fix (PRD 2508), as the runner reported them on a done job: at most five, each {repos, summary}, in the order the hand-off wrote them. An empty list for a job with none, a job of another skill and a runner on an older kit.';
