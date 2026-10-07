-- The GitHub snapshot of each PRD dossier (PRD 902, s2, docs:
-- .omni-loop/delivery/inbox/0902-github-budget/spec.md): what GitHub said of a numbered PRD the last
-- time it was read, so the PRD page, the outbox recount and the outbox send read one stored copy
-- instead of GitHub on every render.
--
-- - dossier_github: one row per dossier. summary is the reader's GithubSummary exactly as it returns
--   it, a part GitHub could not read kept as the string 'unread'. read_at is when it was read.
--   stale_since is set when something says GitHub moved (a webhook, a send, the sync) and cleared by
--   the refresh that reads it again; null while the snapshot is current. refreshing_until is the
--   lease a refresh holds, so one refresh runs at a time per dossier; null when none runs.
--
-- A member of the dossier's workspace reads it. Only the service role writes (the galaxy server, as it
-- writes prd_stages and fix_facts); nobody signed in writes, and nobody deletes: a row goes with its
-- dossier.
--
-- Rollback: a follow-up migration drops dossier_github. The pages then read GitHub again once their
-- route is reverted; nothing else reads it.

create table public.dossier_github (
  dossier_id       uuid primary key references public.dossiers on delete cascade,
  workspace_id     uuid not null references public.workspaces on delete cascade,
  summary          jsonb not null check (jsonb_typeof(summary) = 'object'),
  read_at          timestamptz not null default now(),
  stale_since      timestamptz,
  refreshing_until timestamptz
);

create index dossier_github_workspace_idx on public.dossier_github (workspace_id);

comment on table public.dossier_github is
  'What GitHub said of each PRD dossier when last read, for the PRD page and the outbox recount. Written by the service role (the galaxy server), read by the workspace''s members.';
comment on column public.dossier_github.workspace_id is 'The workspace of the dossier.';
comment on column public.dossier_github.summary is 'The PRD''s GithubSummary, each part the string ''unread'' when GitHub could not read it.';
comment on column public.dossier_github.read_at is 'When GitHub was read.';
comment on column public.dossier_github.stale_since is 'Since when GitHub is known to have moved; null while the snapshot is current.';
comment on column public.dossier_github.refreshing_until is 'The lease of the refresh running now; null when none runs.';

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.dossier_github enable row level security;

create policy "a member reads their workspace's GitHub snapshots" on public.dossier_github
  for select to authenticated
  using (public.is_member(workspace_id));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.dossier_github from public, anon, authenticated, service_role;
grant select on public.dossier_github to authenticated;
-- The galaxy server, as the service role: read, add, refresh and lease; never delete.
grant select, insert, update on public.dossier_github to service_role;
