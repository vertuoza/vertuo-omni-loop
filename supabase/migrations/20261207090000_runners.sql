-- Runners (PRD 1830 s1, docs: .omni-loop/delivery/inbox/1830-runners/spec.md, sections Data and The
-- routes): a machine running `omni runner` registers with the Omni app and takes jobs, each one
-- `/omni:` line a person sent from the app with Send to terminal.
--
-- - runners: one row per runner, unique by name in its workspace. Its owner (the person whose kit
--   token registered it), its fleet (a workspace owner sets it; none is a shared runner), its slots
--   (1 to 8), the repositories it holds, the kit version, and when it last checked in. Online, busy and
--   offline are read from the times and the jobs (apps/galaxy/src/runners/runners.service.ts), never
--   stored.
-- - runner_jobs: one row per job: the line, the repository, where it goes (one runner, a fleet, or
--   neither: any runner of the workspace), who sent it, its status, the runner that claimed it, a
--   cancel waiting, its log tail (the last 200 lines, 16 KB at most), its pull request, exit code and
--   reason, and a time per step: queued, claimed, running, ended.
-- - runner_claim(runner): the runner takes the oldest queued job it may run, in one statement
--   (`for update skip locked`), so two runners never take one job: addressed to it, to its fleet, or,
--   for a runner with no fleet only, to any runner; for a repository it holds; while it has a free slot.
-- - runners_mark_lost(cutoff): the claimed and running jobs of a runner silent since before `cutoff`
--   end `failed`, reason `runner lost`. Nothing is retried by itself.
--
-- The routes write both tables as the service role, which holds the rules (who may send where, which
-- status follows which); a member of the workspace reads them, anyone else reads nothing, and nobody
-- signed in writes them.
--
-- Proven by supabase/checks/runners.sql.
-- Rollback: a follow-up migration drops runner_claim(), runners_mark_lost(), runner_jobs and runners.
-- Nothing else reads them.

create table public.runners (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner        uuid not null references auth.users (id) on delete cascade,
  name         text not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'),
  fleet        text,
  slots        smallint not null default 4 check (slots between 1 and 8),
  repos        text[] not null default '{}' check (cardinality(repos) <= 50),
  version      text not null default '' check (char_length(version) <= 40),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (workspace_id, name),
  foreign key (workspace_id, fleet) references public.teams (workspace_id, name) on update cascade
);

comment on table public.runners is
  'A machine running `omni runner` (PRD 1830): registered by its owner''s kit token, written by the routes as the service role, read by the workspace''s members.';
comment on column public.runners.owner is 'The person whose kit token registered it: the jobs run under their GitHub and Claude accounts.';
comment on column public.runners.fleet is 'The fleet it serves (public.teams), set by a workspace owner; null: a shared runner, which also takes jobs sent to any runner.';
comment on column public.runners.repos is 'The repositories it holds, owner/name in lower case.';
comment on column public.runners.last_seen_at is 'Its last check-in (a `next`, or a job update). Silent for over 90 seconds, it is offline.';

create table public.runner_jobs (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  line             text not null check (char_length(line) between 7 and 240),
  repo             text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  to_runner        uuid references public.runners (id) on delete cascade,
  to_fleet         text,
  sent_by          uuid not null references auth.users (id) on delete cascade,
  status           text not null default 'queued' check (status in ('queued', 'claimed', 'running', 'done', 'failed', 'cancelled')),
  runner_id        uuid references public.runners (id) on delete cascade,
  cancel_requested boolean not null default false,
  log_tail         text not null default '' check (octet_length(log_tail) <= 16384),
  pr_url           text check (pr_url is null or (pr_url ~ '^https://' and char_length(pr_url) <= 300)),
  exit_code        integer,
  reason           text check (reason is null or char_length(reason) <= 200),
  queued_at        timestamptz not null default now(),
  claimed_at       timestamptz,
  running_at       timestamptz,
  ended_at         timestamptz,
  constraint runner_jobs_one_target check (to_runner is null or to_fleet is null),
  constraint runner_jobs_claimed_shape check ((status = 'queued') = (runner_id is null) or status = 'cancelled'),
  constraint runner_jobs_ended_shape check ((status in ('done', 'failed', 'cancelled')) = (ended_at is not null)),
  foreign key (workspace_id, to_fleet) references public.teams (workspace_id, name) on update cascade
);

create index runner_jobs_queue_idx on public.runner_jobs (workspace_id, queued_at) where status = 'queued';
create index runner_jobs_runner_idx on public.runner_jobs (runner_id) where status in ('claimed', 'running');
create index runner_jobs_ended_idx on public.runner_jobs (workspace_id, ended_at desc) where ended_at is not null;

comment on table public.runner_jobs is
  'One /omni: line sent to a runner (PRD 1830): queued by a member, claimed by runner_claim(), reported on by its runner. Written by the routes as the service role, read by the workspace''s members.';
comment on column public.runner_jobs.line is 'The /omni: line, checked by the route and again by the runner: a listed skill, arguments of letters, digits, spaces and ._/:#- only.';
comment on column public.runner_jobs.repo is 'owner/name, in lower case: a repository of the workspace.';
comment on column public.runner_jobs.to_runner is 'The one runner it goes to; null with to_fleet null: any runner of the workspace.';
comment on column public.runner_jobs.to_fleet is 'The fleet whose runners it goes to; null with to_runner null: any runner of the workspace.';
comment on column public.runner_jobs.cancel_requested is 'A cancel waits: the runner kills the job at its next report, then marks it cancelled.';
comment on column public.runner_jobs.log_tail is 'The last 200 lines of the run''s log, 16 KB at most.';
comment on column public.runner_jobs.reason is 'Why it failed or ended: runner lost, timeout, or the runner''s words.';

-- ── The claim ───────────────────────────────────────────────────────────────────

-- The oldest queued job the runner may run, claimed for it: none when it has no free slot. The
-- runner's row is locked first, so two `next` of one runner count its slots one after the other; the
-- job is taken `for update skip locked`, so two runners never take the same one.
create function public.runner_claim(p_runner uuid) returns setof public.runner_jobs
language plpgsql
set search_path = ''
as $$
declare
  r    public.runners;
  busy integer;
begin
  select * into r from public.runners where id = p_runner for update;
  if r.id is null then
    return;
  end if;
  select count(*) into busy from public.runner_jobs j where j.runner_id = r.id and j.status in ('claimed', 'running');
  if busy >= r.slots then
    return;
  end if;
  return query
  update public.runner_jobs j
     set status = 'claimed', runner_id = r.id, claimed_at = now()
   where j.id = (
     select q.id from public.runner_jobs q
      where q.workspace_id = r.workspace_id
        and q.status = 'queued'
        and not q.cancel_requested
        and q.repo = any (r.repos)
        and (q.to_runner = r.id
             or (q.to_runner is null and q.to_fleet is not null and q.to_fleet = r.fleet)
             or (q.to_runner is null and q.to_fleet is null and r.fleet is null))
      order by q.queued_at, q.id
      limit 1
      for update skip locked)
     and j.status = 'queued'
  returning j.*;
end;
$$;

-- The claimed and running jobs of every runner silent since before `p_cutoff` end failed, reason
-- `runner lost`. Answers how many.
create function public.runners_mark_lost(p_cutoff timestamptz) returns integer
language plpgsql
set search_path = ''
as $$
declare
  lost integer;
begin
  update public.runner_jobs j
     set status = 'failed', reason = 'runner lost', ended_at = now()
    from public.runners r
   where r.id = j.runner_id and j.status in ('claimed', 'running') and r.last_seen_at < p_cutoff;
  get diagnostics lost = row_count;
  return lost;
end;
$$;

revoke execute on function public.runner_claim(uuid) from public, anon, authenticated;
grant execute on function public.runner_claim(uuid) to service_role;
revoke execute on function public.runners_mark_lost(timestamptz) from public, anon, authenticated;
grant execute on function public.runners_mark_lost(timestamptz) to service_role;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.runners enable row level security;
alter table public.runner_jobs enable row level security;

create policy "a member reads their workspace's runners" on public.runners
  for select to authenticated
  using (public.is_member(workspace_id));

create policy "a member reads their workspace's runner jobs" on public.runner_jobs
  for select to authenticated
  using (public.is_member(workspace_id));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the tables: the routes do, as the service role.
revoke all on public.runners, public.runner_jobs from public, anon, authenticated, service_role;
grant select on public.runners, public.runner_jobs to authenticated;
grant select, insert, update on public.runners, public.runner_jobs to service_role;
