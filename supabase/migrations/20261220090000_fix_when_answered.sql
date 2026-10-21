-- A runner job waiting on answers fixes by itself once they are in (PRD 2270, docs:
-- .omni-loop/delivery/inbox/2270-fix-when-answered/spec.md).
--
-- - runner_jobs.continues: the job this one continues, a `/omni:yolo-fix <n>` the page queued once every
--   asked item of a job that ended on Waiting on answers had a counted reply; null for any other job. A
--   job is continued once: the unique index refuses a second continuation, so two touches at once never
--   queue two fixes. A continued job that is deleted leaves its continuation in place, linked to none.
-- - repositories.fix_when_answered: whether the page queues that fix by itself, on by default. Off, the
--   Runners page offers Fix with answers instead. Only the workspace's owner switches it, through
--   set_repository_fix_when_answered(), built like set_repository_phase0() of
--   20261122090000_phase0_flag.sql: security definer, run as the signed-in person, refusing anyone else
--   with 42501.
--
-- runner_jobs and repositories keep their grants and their row-level security: a member of the
-- workspace reads both columns with the row; only the service role, through the routes, writes
-- `continues`, and nobody signed in writes `fix_when_answered` but through the function.
--
-- Rollback: a follow-up migration drops set_repository_fix_when_answered(), the index and both columns.
-- Nothing else reads them.

-- ── The continuation ─────────────────────────────────────────────────────────────

alter table public.runner_jobs add column continues uuid references public.runner_jobs (id) on delete set null;

create unique index runner_jobs_continues_key on public.runner_jobs (continues) where continues is not null;

comment on column public.runner_jobs.continues is
  'The job this one continues (PRD 2270): a /omni:yolo-fix queued once the answers a job waited on were in. Unique: a job is continued once. Null for any other job.';

-- ── The switch ───────────────────────────────────────────────────────────────────

alter table public.repositories add column fix_when_answered boolean not null default true;

comment on column public.repositories.fix_when_answered is
  'Whether a runner job that waited on answers is fixed by itself once they are in (PRD 2270). On by default; only the workspace''s owner switches it, through set_repository_fix_when_answered().';

-- Switches a repository's Fix on a runner once answered on or off. The owner's only.
create function public.set_repository_fix_when_answered(p_workspace uuid, p_full_name text, p_on boolean) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.repositories;
begin
  perform public.repository_owner_only(p_workspace);
  if p_on is null then
    raise exception 'Fix on a runner once answered: on or off.' using errcode = '22023', hint = 'fix_when_answered';
  end if;
  update public.repositories r
     set fix_when_answered = p_on
   where r.workspace_id = p_workspace and r.full_name = lower(btrim(coalesce(p_full_name, '')))
  returning * into changed;
  if not found then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  return changed;
end;
$$;

revoke execute on function public.set_repository_fix_when_answered(uuid, text, boolean) from public, anon;
grant execute on function public.set_repository_fix_when_answered(uuid, text, boolean) to authenticated;
