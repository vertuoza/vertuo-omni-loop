-- PRD outboxes (PRD 657, s5, docs: .omni-loop/delivery/inbox/0657-snappy-pages/spec.md): how many open
-- outbox questions each PRD of a workspace's repositories has, stored, so the PRD list (/prd) and the
-- waiting outbox (/api/waiting/outbox) never wait on GitHub.
--
-- - prd_outbox: one row per PRD (a repository and an issue number). open_questions counts the open
--   items of its outbox, as the Outbox tab counts them; waiting keeps those of them that wait on a
--   person (ranked human-action or high, while the feature PR is open), each as {id, rank, question},
--   for the waiting list. The stages sync fills it every 15 minutes: a PRD at building or outbox
--   stores its counts, any other stores 0 and no waiting item. A stage event and a Send recount their
--   one PRD. The counts may lag up to 15 minutes behind an answer typed on GitHub.
--
-- A member of the workspace reads it. Only the service role writes, for the sync, the stage events
-- and the sends; nobody signed in writes, and nobody deletes.
--
-- Rollback: a follow-up migration drops prd_outbox. /prd and the waiting outbox then read GitHub
-- again once their readers are reverted; nothing else reads it.

create table public.prd_outbox (
  workspace_id   uuid not null references public.workspaces on delete cascade,
  repository     text not null check (repository = lower(repository) and repository ~ '^[^/\s]+/[^/\s]+$'),
  prd            integer not null check (prd > 0),
  open_questions integer not null default 0 check (open_questions >= 0),
  waiting        jsonb not null default '[]'::jsonb check (jsonb_typeof(waiting) = 'array'),
  synced_at      timestamptz not null default now(),
  primary key (workspace_id, repository, prd)
);

comment on table public.prd_outbox is
  'The open outbox questions of each PRD (a repository and its issue number) of a workspace. Written by the service role (the stages sync, stage events and sends), read by the workspace''s members.';
comment on column public.prd_outbox.repository is 'owner/name of the PRD''s repository, in lower case, as a dossier''s home_repo keeps it.';
comment on column public.prd_outbox.open_questions is 'How many items of the PRD''s outbox are open; 0 for a PRD at neither building nor outbox.';
comment on column public.prd_outbox.waiting is 'The open items that wait on a person (human-action or high, feature PR open), each {id, rank, question}.';
comment on column public.prd_outbox.synced_at is 'When the counts were last taken.';

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.prd_outbox enable row level security;

create policy "a member reads their workspace's outboxes" on public.prd_outbox
  for select to authenticated
  using (public.is_member(workspace_id));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.prd_outbox from public, anon, authenticated, service_role;
grant select on public.prd_outbox to authenticated;
-- The sync, the stage events and the sends, as the service role: read, add and recount; never delete.
grant select, insert, update on public.prd_outbox to service_role;
