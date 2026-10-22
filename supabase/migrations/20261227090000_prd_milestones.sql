-- A PRD's milestones (PRD 2370, docs: .omni-loop/delivery/inbox/2370-prd-timeline/spec.md): when each PRD
-- of a workspace's repositories reached each moment of its timeline, idea to merged, so the gaps between
-- them (how long each step took, and who it waited on) are computed without reading GitHub.
--
-- - prd_milestones: one row per PRD (a repository and an issue number), lane and milestone. A lane is a
--   repository the PRD lands in: the PRD's own for a one-lane PRD, one per target for a PRD of a plan
--   repository. A PRD-level milestone (idea, plan, approved) has the PRD's own repository as lane and no
--   pull request; a lane milestone (opened, first-slice, last-slice, ready, merged) names its pull
--   request. Every time is GitHub's or the dossier's own, never the sync's: a milestone nobody dated is
--   not written. The trigger below keeps the first reached_at of every milestone but last-slice, which
--   only moves later (a rework slice merged after ready).
--
-- prd_stages stays as it is: it feeds the stage pills. A member of the workspace reads these rows. Only
-- the service role writes, for the stages sync; nobody signed in writes, and nobody deletes.
--
-- Rollback: a follow-up migration drops prd_milestones. Nothing but the timeline reads it.

create table public.prd_milestones (
  workspace_id uuid not null references public.workspaces on delete cascade,
  repository   text not null check (repository = lower(repository) and repository ~ '^[^/\s]+/[^/\s]+$'),
  prd          integer not null check (prd > 0),
  lane         text not null check (lane = lower(lane) and lane ~ '^[^/\s]+/[^/\s]+$'),
  milestone    text not null check (milestone in ('idea', 'plan', 'approved', 'opened', 'first-slice', 'last-slice', 'ready', 'merged')),
  pr           integer check (pr > 0),
  reached_at   timestamptz not null,
  synced_at    timestamptz not null default now(),
  primary key (workspace_id, repository, prd, lane, milestone),
  check ((milestone in ('idea', 'plan', 'approved')) = (pr is null))
);

comment on table public.prd_milestones is
  'When each PRD (a repository and its issue number) of a workspace reached each milestone of its timeline, per lane (a repository it lands in). The first time is kept, but last-slice only moves later. Written by the service role (the stages sync), read by the workspace''s members.';
comment on column public.prd_milestones.repository is 'owner/name of the PRD''s repository, in lower case, as a dossier''s home_repo keeps it.';
comment on column public.prd_milestones.lane is 'owner/name of the repository the milestone happened in, in lower case: the PRD''s own for idea, plan and approved.';
comment on column public.prd_milestones.pr is 'The pull request that dates a lane milestone; null for idea, plan and approved.';
comment on column public.prd_milestones.reached_at is 'GitHub''s or the dossier''s own time, never the sync''s. Kept once written, but last-slice moves later.';
comment on column public.prd_milestones.synced_at is 'When the milestone was last seen by the sync.';

-- The first time wins: a later write (an upsert of the same milestone) refreshes synced_at only, except
-- for last-slice, which takes a later time and its pull request, and never an earlier one.
create function public.prd_milestones_keep_first() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.milestone = 'last-slice' and new.reached_at > old.reached_at then
    return new;
  end if;
  new.reached_at := old.reached_at;
  new.pr := old.pr;
  return new;
end;
$$;

create trigger prd_milestones_keep_first
  before update on public.prd_milestones
  for each row execute function public.prd_milestones_keep_first();

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.prd_milestones enable row level security;

create policy "a member reads their workspace's milestones" on public.prd_milestones
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.prd_milestones from public, anon, authenticated, service_role;
grant select on public.prd_milestones to authenticated;
-- The stages sync, as the service role: read, add and refresh; never delete.
grant select, insert, update on public.prd_milestones to service_role;
