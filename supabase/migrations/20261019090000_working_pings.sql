-- Who is working (PRD 757, s2, docs: .omni-loop/delivery/inbox/0757-play-while-working/spec.md): the
-- terminal's heartbeat, kept one row per Claude session, so the PRD, fix and /ask pages can tell that
-- Claude is working between two questions.
--
-- - working_pings: one row per Claude session. The kit's `omni heartbeat` calls
--   POST /api/ask/heartbeat at most once a minute while a signed-in terminal works, and once more with
--   `ended` when its session ends. The row holds the session's owner, the workspace the repository
--   belongs to for them (repo_workspace(), as an ask session is placed), the repository, what the
--   session works on (a draft, or a PRD, visual fix or bug fix by its number, or nothing), the dossier
--   that work resolves to (null while there is none yet: every ping resolves it again), when it was
--   last seen and when it ended.
-- - working_ping(): the only writer. It upserts the caller's own row; a row of another account is
--   refused (42501), and so is a repository no workspace of the caller owns. Nobody signed in writes
--   the table directly.
--
-- Only the Claude session id, the repository, the work's kind and number (or the draft's id) and the
-- time are stored: no tool, no path, no text. A member of the workspace reads the rows, as they read
-- its dossiers; anyone else reads nothing.
--
-- Rollback: a follow-up migration drops working_ping() and working_pings. Nothing else reads them.

create table public.working_pings (
  claude_session_id text primary key check (char_length(claude_session_id) between 1 and 200),
  user_id           uuid not null references auth.users (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  repo              text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  work_kind         text check (work_kind in ('draft', 'prd', 'visual', 'bug')),
  work_number       integer check (work_number is null or work_number > 0),
  dossier_id        uuid references public.dossiers (id) on delete set null,
  seen_at           timestamptz not null default now(),
  ended_at          timestamptz,
  constraint working_pings_work_shape check (
    (work_kind is null and work_number is null)
    or (work_kind = 'draft' and work_number is null)
    or (work_kind in ('prd', 'visual', 'bug') and work_number is not null)
  )
);

create index working_pings_dossier_idx on public.working_pings (dossier_id, seen_at desc) where dossier_id is not null;
create index working_pings_workspace_idx on public.working_pings (workspace_id);

comment on table public.working_pings is
  'A Claude session''s heartbeat (PRD 757): one row per session, written by its owner through working_ping(), read by the workspace''s members.';
comment on column public.working_pings.workspace_id is 'The workspace the repository belongs to for the owner (repo_workspace()), never sent.';
comment on column public.working_pings.repo is 'owner/name, in lower case.';
comment on column public.working_pings.work_kind is 'draft, prd, visual or bug; null when the session works on nothing the kit could name.';
comment on column public.working_pings.work_number is 'The PRD''s or the fix''s number; null for a draft or no work.';
comment on column public.working_pings.dossier_id is 'The dossier the work resolves to, at the last ping: the draft, or the one keyed by workspace, repository, kind and number; null when none exists yet.';
comment on column public.working_pings.seen_at is 'The last heartbeat.';
comment on column public.working_pings.ended_at is 'When the session said it ended; null while it has not.';

-- ── The only writer ─────────────────────────────────────────────────────────────

-- Upserts the caller's row for `p_claude_session_id`. `p_work_kind` is null, draft (with `p_draft`),
-- or prd, visual or bug (with `p_work_number`). With `p_ended`, the row is stamped ended and keeps the
-- work it had; a ping without it clears any end. Refused: 42501 signed out, a repository no workspace
-- of the caller owns, or a session another account owns; 22023 a malformed argument.
create function public.working_ping(
  p_claude_session_id text,
  p_repo              text,
  p_work_kind         text default null,
  p_work_number       integer default null,
  p_draft             uuid default null,
  p_ended             boolean default false
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_ended   boolean := coalesce(p_ended, false);
  v_dossier uuid;
  v_owner   uuid;
  pick      record;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_claude_session_id is null or char_length(p_claude_session_id) not between 1 and 200 then
    raise exception 'A heartbeat names its Claude session.' using errcode = '22023';
  end if;
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'A heartbeat names its repository as owner/name.' using errcode = '22023';
  end if;
  if not (
    (p_work_kind is null and p_work_number is null and p_draft is null)
    or (p_work_kind = 'draft' and p_draft is not null and p_work_number is null)
    or (p_work_kind in ('prd', 'visual', 'bug') and p_work_number > 0 and p_draft is null)
  ) then
    raise exception 'The work is a draft by its id, or a prd, visual or bug by its number.' using errcode = '22023';
  end if;

  select c.user_id into v_owner from public.working_pings c where c.claude_session_id = p_claude_session_id for update;
  if v_owner is not null and v_owner <> caller then
    raise exception 'This Claude session is another account''s.' using errcode = '42501';
  end if;

  select * into pick from public.repo_workspace(caller, v_repo);
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;

  if p_work_kind = 'draft' then
    select d.id into v_dossier from public.dossiers d where d.id = p_draft and d.workspace_id = pick.workspace_id;
  elsif p_work_kind is not null then
    select d.id into v_dossier from public.dossiers d
     where d.workspace_id = pick.workspace_id and d.home_repo = v_repo and d.kind = p_work_kind and d.prd = p_work_number;
  end if;

  if v_ended then
    -- The end keeps the work the session had: its dossier reads it as ended, not as gone.
    insert into public.working_pings as w (claude_session_id, user_id, workspace_id, repo, work_kind, work_number, dossier_id, seen_at, ended_at)
    values (p_claude_session_id, caller, pick.workspace_id, v_repo, p_work_kind, p_work_number, v_dossier, now(), now())
    on conflict (claude_session_id) do update
      set seen_at = now(), ended_at = now();
  else
    insert into public.working_pings as w (claude_session_id, user_id, workspace_id, repo, work_kind, work_number, dossier_id, seen_at, ended_at)
    values (p_claude_session_id, caller, pick.workspace_id, v_repo, p_work_kind, p_work_number, v_dossier, now(), null)
    on conflict (claude_session_id) do update
      set workspace_id = excluded.workspace_id, repo = excluded.repo, work_kind = excluded.work_kind,
          work_number = excluded.work_number, dossier_id = excluded.dossier_id, seen_at = now(), ended_at = null;
  end if;
end;
$$;

revoke execute on function public.working_ping(text, text, text, integer, uuid, boolean) from public, anon;
grant execute on function public.working_ping(text, text, text, integer, uuid, boolean) to authenticated;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.working_pings enable row level security;

create policy "a member reads their workspace's working pings" on public.working_pings
  for select to authenticated
  using (public.is_member(workspace_id));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the table: working_ping() does, as its owner.
revoke all on public.working_pings from public, anon, authenticated, service_role;
grant select on public.working_pings to authenticated;
grant select on public.working_pings to service_role;
