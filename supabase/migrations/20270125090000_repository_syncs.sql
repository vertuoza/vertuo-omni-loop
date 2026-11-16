-- When the stages sync last read each repository (#2963), so it reads first the ones that waited longest and
-- only what changed since its last read.
--
-- Before, the sync took that date from the newest `prd` row of public.prd_stages, which it rewrites only when a
-- PRD issue changed. A quiet repository never looked read: it went first in every run and was read again from
-- an older date each time, while a repository holding a new PRD waited behind the quiet ones run after run,
-- its page reading Syncing… for hours.
--
-- - repository_syncs: one row per repository of a workspace, holding when the sync last read it. Stage events
--   never write it. Backfilled from the newest `prd` row of each repository, the date the sync used until now,
--   so no repository is read in full again.
--
-- Only the service role reads and writes it, for the sync; nobody signed in, nor signed out, touches it.
--
-- Rollback: a follow-up migration drops repository_syncs, and the sync reads the newest `prd` row again.

create table public.repository_syncs (
  workspace_id uuid not null references public.workspaces on delete cascade,
  repository   text not null check (repository = lower(repository) and repository ~ '^[^/\s]+/[^/\s]+$'),
  synced_at    timestamptz not null,
  primary key (workspace_id, repository)
);

comment on table public.repository_syncs is
  'When the stages sync last read each repository of a workspace, whatever stages it wrote. Written and read by the service role (the stages sync) only.';
comment on column public.repository_syncs.repository is 'owner/name of the repository, in lower case, as prd_stages keeps it.';
comment on column public.repository_syncs.synced_at is 'When the sync last read the repository: the time its run started.';

insert into public.repository_syncs (workspace_id, repository, synced_at)
select workspace_id, repository, max(synced_at)
from public.prd_stages
where stage = 'prd'
group by workspace_id, repository;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.repository_syncs enable row level security;
-- No policy: no browser role reads or writes it.

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.repository_syncs from public, anon, authenticated, service_role;
-- The sync, as the service role: read, add and refresh; never delete.
grant select, insert, update on public.repository_syncs to service_role;
