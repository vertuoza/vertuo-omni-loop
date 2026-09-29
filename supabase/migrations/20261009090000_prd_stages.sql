-- Real PRD stages (PRD 587, docs: .omni-loop/delivery/inbox/0587-real-stages/spec.md): where each PRD
-- of a workspace's repositories is, stored, so its page never waits on GitHub and the lists can count
-- PRDs per stage.
--
-- - prd_stages: the date each PRD (a repository and an issue number) reached each stage, one row per
--   stage. The current stage is the latest one on the track. A stage is recorded once: writing it again
--   refreshes synced_at, and the trigger below keeps the first reached_at, so a stage never moves.
--   idea is never stored: it belongs to drafts, and is read from the dossier's rounds.
-- - prd_topics: the topic of each PRD's folder (`<nnnn>-<topic>`), so a pull request whose body names no
--   PRD (a retro's) still finds it.
--
-- A member of the workspace reads both. Only the service role writes, for the sync and the stage events
-- galaxy receives; nobody signed in writes, and nobody deletes.
--
-- Rollback: a follow-up migration drops prd_topics and prd_stages. Nothing else reads them.

create table public.prd_stages (
  workspace_id uuid not null references public.workspaces on delete cascade,
  repository   text not null check (repository = lower(repository) and repository ~ '^[^/\s]+/[^/\s]+$'),
  prd          integer not null check (prd > 0),
  stage        text not null check (stage in ('prd', 'inbox', 'building', 'outbox', 'shipped', 'retro')),
  reached_at   timestamptz not null,
  synced_at    timestamptz not null default now(),
  primary key (workspace_id, repository, prd, stage)
);

comment on table public.prd_stages is
  'When each PRD (a repository and its issue number) of a workspace reached each stage. Recorded once, never moved back: a second write keeps the first reached_at. Written by the service role (the stages sync and stage events), read by the workspace''s members.';
comment on column public.prd_stages.repository is 'owner/name of the PRD''s repository, in lower case, as a dossier''s home_repo keeps it.';
comment on column public.prd_stages.reached_at is 'When the stage was reached: the event''s own date, or the sync''s time when none was found. Never changed once written.';
comment on column public.prd_stages.synced_at is 'When the stage was last seen, by the sync or an event.';

create table public.prd_topics (
  workspace_id uuid not null references public.workspaces on delete cascade,
  repository   text not null check (repository = lower(repository) and repository ~ '^[^/\s]+/[^/\s]+$'),
  prd          integer not null check (prd > 0),
  topic        text not null check (topic ~ '^[a-z0-9][a-z0-9-]*$' and char_length(topic) <= 200),
  primary key (workspace_id, repository, prd),
  unique (workspace_id, repository, topic)
);

comment on table public.prd_topics is
  'The topic of each PRD''s folder (<nnnn>-<topic>), learnt by the stages sync, so a stage event whose pull request names no PRD finds it by (repository, topic).';

-- A stage is recorded once: a later write (an upsert of the same stage) refreshes synced_at only.
create function public.prd_stages_keep_first() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reached_at := old.reached_at;
  return new;
end;
$$;

create trigger prd_stages_keep_first
  before update on public.prd_stages
  for each row execute function public.prd_stages_keep_first();

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.prd_stages enable row level security;
alter table public.prd_topics enable row level security;

create policy "a member reads their workspace's stages" on public.prd_stages
  for select to authenticated
  using (public.is_member(workspace_id));

create policy "a member reads their workspace's topics" on public.prd_topics
  for select to authenticated
  using (public.is_member(workspace_id));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.prd_stages from public, anon, authenticated, service_role;
revoke all on public.prd_topics from public, anon, authenticated, service_role;
grant select on public.prd_stages to authenticated;
grant select on public.prd_topics to authenticated;
-- The sync and the stage events, as the service role: read, add and refresh; never delete.
grant select, insert, update on public.prd_stages to service_role;
grant select, insert, update on public.prd_topics to service_role;
