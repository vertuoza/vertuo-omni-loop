-- The waits (PRD 2377, docs: .omni-loop/delivery/inbox/2377-waiting-board/spec.md): each thing in a
-- workspace's repositories that waits on a person to ship, with whose turn it is and since when, so the
-- Waiting page and the bell read one table and never GitHub.
--
-- - One row per wait: a PRD not yet approved (`approval`), a feature PR held by its outbox (`outbox`), a
--   pull request held by a locked law (`law`), one waiting for a review (`review`) or for a merge
--   (`merge`). `prd` is null for a bug fix or visual update, `pr` for an `approval`.
-- - `turn` holds whose turn it is: GitHub logins and `org/team`s, empty for "any approver" or "anyone who
--   can merge". It moves with what GitHub shows.
-- - Kept like a stage: `since` is written once and never moved, and an ended row is kept, never deleted,
--   so the time spent waiting can be measured later. A wait has at most one open row; seen again after it
--   ended, it opens a new one. The trigger below keeps a row's identity, its since and its end.
--
-- A member of the workspace reads its rows (L-GDPR-1: `turn` holds GitHub logins). Only the service role
-- writes, for the stages sync; nobody signed in writes, and nobody deletes (L-GDPR-3, L-GDPR-4: an ended
-- row records a decision waited on, and who was asked).
--
-- Rollback: a follow-up migration drops public.waits and public.waits_keep(). Nothing else reads them.

create table public.waits (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  repo         text not null check (repo = lower(repo) and repo ~ '^[^/\s]+/[^/\s]+$'),
  prd          integer check (prd > 0),
  pr           integer check (pr > 0),
  kind         text not null check (kind in ('approval', 'outbox', 'law', 'review', 'merge')),
  turn         text[] not null default '{}' check (cardinality(turn) <= 100),
  since        timestamptz not null,
  seen_at      timestamptz not null,
  ended_at     timestamptz,
  -- An approval is a PRD's and has no pull request; every other wait is a pull request's.
  check ((kind = 'approval') = (pr is null)),
  -- An approval and an outbox wait are a PRD's.
  check (kind not in ('approval', 'outbox') or prd is not null)
);

comment on table public.waits is
  'What waits on a person to ship, in a workspace''s repositories: one row per wait, whose turn it is and since when. Written by the stages sync (the service role), read by the workspace''s members. Kept: since never moves, an ended row is never deleted.';
comment on column public.waits.repo is 'owner/name of the repository, in lower case, as a dossier''s home_repo keeps it.';
comment on column public.waits.prd is 'The PRD''s number; null for a bug fix or a visual update.';
comment on column public.waits.pr is 'The pull request''s number; null for an approval.';
comment on column public.waits.turn is 'Whose turn: GitHub logins and org/teams; empty for any approver, or anyone who can merge.';
comment on column public.waits.since is 'When the wait began. Written once, never moved.';
comment on column public.waits.seen_at is 'The last sync that saw the wait.';
comment on column public.waits.ended_at is 'Null while it waits; the first sync that no longer saw it. Never cleared once set.';

-- One open row per wait; the workspace first, for the page's read of its open waits.
create unique index waits_one_open on public.waits (workspace_id, repo, prd, pr, kind) nulls not distinct
  where ended_at is null;

-- A row's identity, its since and its end are written once: an update moves turn, seen_at, and an open
-- row's ended_at only.
create function public.waits_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.workspace_id := old.workspace_id;
  new.repo := old.repo;
  new.prd := old.prd;
  new.pr := old.pr;
  new.kind := old.kind;
  new.since := old.since;
  if old.ended_at is not null then
    new.ended_at := old.ended_at;
  end if;
  return new;
end;
$$;

create trigger waits_keep
  before update on public.waits
  for each row execute function public.waits_keep();

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.waits enable row level security;

create policy "a member reads their workspace's waits" on public.waits
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.waits from public, anon, authenticated, service_role;
grant select on public.waits to authenticated;
-- The stages sync, as the service role: read, open and refresh; never delete.
grant select, insert, update on public.waits to service_role;
