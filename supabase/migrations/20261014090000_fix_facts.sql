-- Fix facts (PRD 691, s1, docs: .omni-loop/delivery/inbox/0691-fast-fix-lists/spec.md): what GitHub says
-- of each fix dossier (a visual or bug fix), stored, so Bug Fixes (/bugs) and Visual Updates (/visual)
-- render their pills without a GitHub read.
--
-- - fix_facts: one row per fix dossier. facts is the fix's FixSummary (its issue, pull request,
--   approvals and release) as the reader returns it, a part GitHub could not read kept as the string
--   'unread'. The stages sync refreshes every fix with no stored release every 15 minutes, and a fix's
--   own page writes back what it read; a part that could not be read keeps its stored value. A fix
--   whose stored facts hold a release is final and is not read again.
--
-- A member of the workspace reads it. Only the service role writes; nobody signed in writes, and
-- nobody deletes: a row goes with its dossier.
--
-- Rollback: a follow-up migration drops fix_facts. /bugs and /visual then read GitHub again once their
-- route is reverted; nothing else reads it.

create table public.fix_facts (
  dossier_id   uuid primary key references public.dossiers on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  facts        jsonb not null check (jsonb_typeof(facts) = 'object'),
  synced_at    timestamptz not null default now()
);

create index fix_facts_workspace_idx on public.fix_facts (workspace_id);

comment on table public.fix_facts is
  'What GitHub says of each fix dossier (visual or bug), stored for the fix lists. Written by the service role (the stages sync and the fix pages), read by the workspace''s members.';
comment on column public.fix_facts.workspace_id is 'The workspace of the fix''s dossier.';
comment on column public.fix_facts.facts is 'The fix''s FixSummary: {issue, pull, approvals, release}, each part the string ''unread'' when GitHub could not read it.';
comment on column public.fix_facts.synced_at is 'When the facts were last read.';

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.fix_facts enable row level security;

create policy "a member reads their workspace's fix facts" on public.fix_facts
  for select to authenticated
  using (public.is_member(workspace_id));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.fix_facts from public, anon, authenticated, service_role;
grant select on public.fix_facts to authenticated;
-- The sync and the fix pages, as the service role: read, add and refresh; never delete.
grant select, insert, update on public.fix_facts to service_role;
