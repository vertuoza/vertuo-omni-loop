-- A runner job the Omni app sends (PRD 2338, docs: .omni-loop/delivery/inbox/2338-retro-apply/spec.md,
-- Decisions): the retro app queues `/omni:retro-apply --retro <retro PR>` for a repository, and no
-- person asked for it, so it is never recorded in a person's name (Never 10).
--
-- - runner_jobs.sent_by_app: who sent the job when it was not a person, only `'omni-app'`. Null for a
--   job a person or their API key sent.
-- - runner_jobs.sent_by: may be null, for an app-sent job.
-- - runner_jobs_one_sender: exactly one of the two is set, so a job always has one sender of record and
--   never two.
--
-- Nothing changes for an existing job: each has a person in sent_by and null in sent_by_app. A member of
-- the workspace reads an app-sent job as any other (the table's existing policy); nobody signed in writes.
--
-- Proven by supabase/checks/runner_job_sender.sql.
-- Rollback: a follow-up migration deletes the app-sent jobs, drops runner_jobs_one_sender and
-- sent_by_app, and restores `sent_by not null`; run it once no app-sent job needs to stay.

alter table public.runner_jobs
  alter column sent_by drop not null,
  add column sent_by_app text check (sent_by_app = 'omni-app'),
  add constraint runner_jobs_one_sender check ((sent_by is not null) <> (sent_by_app is not null));

comment on column public.runner_jobs.sent_by is
  'The person who sent the job, or whose API key did; null when the Omni app sent it (sent_by_app), never both.';
comment on column public.runner_jobs.sent_by_app is
  'The Omni app, when it sent the job and no person asked for it (PRD 2338): only `omni-app`. Null for a person''s or an API key''s job.';
