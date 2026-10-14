-- A runner job's live lines (PRD 1904, docs: .omni-loop/delivery/inbox/1904-runner-live-logs/spec.md,
-- section 3): each line of a job's readable log, numbered by its 1-based line number in the log, as the
-- runner sends them in its reports, for the Runners page's Terminal panel.
--
-- - runner_job_lines: one row per line: its job, the job's workspace (for row-level security), its
--   sequence number, its text (600 characters at most) and when the server received it. One row per
--   job and sequence number: the routes add lines with `on conflict (job_id, seq) do nothing`, so a
--   report sent twice adds nothing, and keep a job's last 20,000 by deleting the ones before
--   (apps/galaxy/src/runners/runners.service.ts).
-- - runner_job_lines_retain(workspace, keep): when a job ends, the lines of the workspace's ended jobs
--   beyond its `keep` most recent (the 50 the Runners page lists) are deleted. Answers how many.
--
-- The routes write the table as the service role, as they write runner_jobs; a member of the workspace
-- reads it, anyone else reads nothing, and nobody signed in writes it.
--
-- Proven by supabase/checks/runner_job_lines.sql.
-- Rollback: a follow-up migration drops runner_job_lines_retain() and runner_job_lines. Nothing else
-- reads them; runner_jobs.log_tail is untouched.

create table public.runner_job_lines (
  job_id       uuid not null references public.runner_jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  seq          integer not null check (seq > 0),
  text         text not null check (char_length(text) <= 600),
  at           timestamptz not null default now(),
  primary key (job_id, seq)
);

comment on table public.runner_job_lines is
  'A runner job''s live lines (PRD 1904): its last 20,000, while the Runners page lists it. Written by the routes as the service role, read by the workspace''s members.';
comment on column public.runner_job_lines.seq is 'The line''s 1-based line number in the job''s readable log.';
comment on column public.runner_job_lines.at is 'When the server received it.';

-- ── Retention ───────────────────────────────────────────────────────────────────

-- The lines of the workspace's ended jobs beyond its `p_keep` most recent, newest first as the Runners
-- page lists them, are deleted. Answers how many lines went.
create function public.runner_job_lines_retain(p_workspace uuid, p_keep integer) returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  delete from public.runner_job_lines l
   using (select j.id from public.runner_jobs j
           where j.workspace_id = p_workspace and j.ended_at is not null
           order by j.ended_at desc, j.id desc
          offset p_keep) old
   where l.job_id = old.id;
  get diagnostics gone = row_count;
  return gone;
end;
$$;

revoke execute on function public.runner_job_lines_retain(uuid, integer) from public, anon, authenticated;
grant execute on function public.runner_job_lines_retain(uuid, integer) to service_role;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.runner_job_lines enable row level security;

-- The person's workspaces are read once per statement, never once per row (bug #1832).
create policy "a member reads their workspace's runner job lines" on public.runner_job_lines
  for select to authenticated
  using (workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the table: the routes do, as the service role, adding lines and deleting old ones.
revoke all on public.runner_job_lines from public, anon, authenticated, service_role;
grant select on public.runner_job_lines to authenticated;
grant select, insert, delete on public.runner_job_lines to service_role;
