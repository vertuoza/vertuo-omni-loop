-- A job's parts (PRD 2537, docs: .omni-loop/delivery/inbox/2537-runner-turnover/spec.md, sections 5 and 6):
-- a runner that turns a job over to another account when one runs out reports the job's runs, one part per
-- account it ran on, with each job report.
--
-- - runner_jobs.parts: the parts its runner last reported, in order, each {agent, model, account, from, to,
--   tokens?, ended, resetsAt?, guessed?, note?}; the routes check each entry's shape (runners.contract.ts),
--   the database checks that it is a list of 20 at most. Null for a job whose runner never reported them
--   (a runner from before this PRD, or an app that refused them once).
--
-- runner_jobs keeps its table-wide grants and its row-level security: a member of the workspace reads the
-- column with the row (BR-PRODUCT-63: a key still reads its own workspace's jobs only), anyone else reads
-- nothing, and only the service role, through the routes, writes it. A part names an account by the id its
-- owner wrote; no secret is ever in it. The accounts of a runner need no column: they ride in
-- runners.health, which is already jsonb.
--
-- Proved by apps/galaxy/src/runners/runners.migration.test.ts.
-- Rollback: a follow-up migration drops runner_jobs.parts. Nothing else reads it.

alter table public.runner_jobs
  add column parts jsonb
    check (parts is null or (jsonb_typeof(parts) = 'array' and jsonb_array_length(parts) <= 20));

comment on column public.runner_jobs.parts is
  'The job''s runs as its runner last reported them (PRD 2537): one part per account it ran on, in order, each {agent, model, account, from, to, tokens?, ended, resetsAt?, guessed?, note?}, at most 20. Null when it never did.';
