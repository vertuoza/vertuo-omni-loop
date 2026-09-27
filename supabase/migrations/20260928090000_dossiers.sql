-- PRD dossiers, step 1 (PRD 216, docs: .omni-loop/delivery/inbox/0216-prd-dossiers/spec.md): one
-- dossier per PRD — its artifacts and every version of each — kept from the minute a brainstorm starts.
--
-- A dossier is keyed by workspace + home repository + PRD number; a draft has no number yet. Its
-- versions are whole files (spec, plan, before-after), each with its SHA-256 hash, its size, its source
-- (kit or github) and who uploaded it or the commit it was read at. A version is added only when its
-- hash differs from the latest version of its kind; the hash is computed here, from the content. A
-- version is never edited. The opener may delete their own draft; nobody deletes a numbered dossier.
--
-- Nobody signed in writes the tables directly. Two security-definer functions do, each checking who
-- calls: dossier_open() opens a draft, dossier_push() finds the dossier, numbers a draft and adds
-- versions. Both add versions through dossier_add_version(), the version rule, which the service role
-- (the fallback that reads each repository's delivery folders) calls too. A member of the workspace
-- reads a dossier and its versions; anyone else reads nothing (supabase/checks/dossiers.sql).
--
-- The home repository is kept in lower case (GitHub's owner/name is not case-sensitive), so the kit's
-- `repo.slug` and the fallback's `<github_org>/<repo>` reach the same dossier.
--
-- Rollback: a follow-up migration drops the three functions and the two tables. Nothing else reads them.

-- ── Tables ──────────────────────────────────────────────────────────────────────

create table public.dossiers (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces on delete cascade,
  home_repo         text not null check (home_repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' and char_length(home_repo) <= 200),
  prd               integer check (prd > 0),
  title             text not null check (char_length(title) between 1 and 200),
  opened_by         uuid references auth.users on delete set null,
  claude_session_id text check (claude_session_id is null or char_length(claude_session_id) between 1 and 200),
  created_at        timestamptz not null default now(),
  numbered_at       timestamptz,
  unique (workspace_id, home_repo, prd),
  constraint dossiers_numbered check ((prd is null) = (numbered_at is null))
);

comment on table public.dossiers is
  'One per PRD: its artifacts, every version of each, and (read through the Claude session and the PRD) the questions that shaped it. Written only by dossier_open(), dossier_push() and the service role.';
comment on column public.dossiers.home_repo is
  'owner/name in lower case: the repository whose issue the PRD is, where the brainstorm ran.';
comment on column public.dossiers.prd is 'The PRD''s number; null while the dossier is a draft.';
comment on column public.dossiers.opened_by is 'Who opened it; null when the fallback created it.';
comment on column public.dossiers.claude_session_id is
  'The Claude Code session the brainstorm ran in (CLAUDE_CODE_SESSION_ID), when the kit could read it.';

create index dossiers_workspace_idx on public.dossiers (workspace_id, created_at desc);
create index dossiers_claude_session_idx on public.dossiers (claude_session_id) where claude_session_id is not null;

create table public.dossier_versions (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references public.dossiers on delete cascade,
  kind        text not null check (kind in ('spec', 'plan', 'before-after')),
  content     text not null,
  sha256      text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes       integer not null check (bytes between 0 and 524288),
  source      text not null check (source in ('kit', 'github')),
  uploaded_by uuid references auth.users on delete set null,
  commit_sha  text check (commit_sha is null or commit_sha ~ '^[0-9a-f]{7,64}$'),
  git_blob    text check (git_blob is null or git_blob ~ '^[0-9a-f]{7,64}$'),
  created_at  timestamptz not null default now(),
  constraint dossier_versions_github_commit check (source <> 'github' or commit_sha is not null)
);

comment on table public.dossier_versions is
  'Every version of a dossier''s artifacts, whole. Added only by dossier_add_version(), when the content''s hash differs from the latest of its kind. Never edited.';
comment on column public.dossier_versions.commit_sha is 'github: the default branch''s head when the file was read.';
comment on column public.dossier_versions.git_blob is 'github: the file''s blob hash, so the fallback fetches only what changed.';

create index dossier_versions_latest_idx on public.dossier_versions (dossier_id, kind, created_at desc);

-- ── The version rule ────────────────────────────────────────────────────────────

-- Adds a version of `p_kind` to the dossier, unless its content hashes the same as the latest version of
-- that kind. Returns the new version's number (its place among its kind's versions, from 1), or null
-- when nothing was added. Takes a lock on the dossier first, so two pushes at once cannot both add one,
-- and dates the version when it is written, after the lock: the latest is always the last added.
-- The kit's pushes call it through dossier_push(); the fallback calls it as the service role.
create function public.dossier_add_version(
  p_dossier     uuid,
  p_kind        text,
  p_content     text,
  p_source      text,
  p_uploaded_by uuid default null,
  p_commit_sha  text default null,
  p_git_blob    text default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  body   bytea := convert_to(p_content, 'UTF8');
  hash   text := encode(sha256(convert_to(p_content, 'UTF8')), 'hex');
  latest text;
begin
  if p_content is null then
    raise exception 'A version needs its content.' using errcode = '22023';
  end if;
  if octet_length(body) > 524288 then
    raise exception 'An artifact holds 512 KiB at most: this % is % bytes.', p_kind, octet_length(body) using errcode = '54000';
  end if;
  perform 1 from public.dossiers d where d.id = p_dossier for update;
  if not found then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  select v.sha256 into latest
    from public.dossier_versions v
   where v.dossier_id = p_dossier and v.kind = p_kind
   order by v.created_at desc, v.id desc
   limit 1;
  if latest is not distinct from hash then
    return null;
  end if;
  insert into public.dossier_versions (dossier_id, kind, content, sha256, bytes, source, uploaded_by, commit_sha, git_blob, created_at)
  values (p_dossier, p_kind, p_content, hash, octet_length(body), p_source, p_uploaded_by, p_commit_sha, p_git_blob, clock_timestamp());
  return (select count(*)::integer from public.dossier_versions v where v.dossier_id = p_dossier and v.kind = p_kind);
end;
$$;

-- ── The kit's two calls ─────────────────────────────────────────────────────────

-- Opens a draft for `p_repo` in the caller's workspace for it: the one whose github_org owns the
-- repository, else the one they joined first (ask_session_workspace()). Returns the draft's id.
-- Refused (42501) for an account signed out or in no workspace.
create function public.dossier_open(p_title text, p_repo text, p_claude_session_id text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  v_repo  text := lower(btrim(coalesce(p_repo, '')));
  v_title text := btrim(coalesce(p_title, ''));
  place   uuid;
  opened  uuid;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if char_length(v_title) not between 1 and 200 then
    raise exception 'A dossier needs a title of 1 to 200 characters.' using errcode = '22023';
  end if;
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
    raise exception 'A dossier needs its repository as owner/name.' using errcode = '22023';
  end if;
  if p_claude_session_id is not null and char_length(p_claude_session_id) not between 1 and 200 then
    raise exception 'A Claude session id is 1 to 200 characters.' using errcode = '22023';
  end if;
  place := public.ask_session_workspace(caller, v_repo);
  if place is null then
    raise exception 'Join a workspace first: a dossier belongs to one.' using errcode = '42501';
  end if;
  insert into public.dossiers (workspace_id, home_repo, title, opened_by, claude_session_id)
  values (place, v_repo, v_title, caller, p_claude_session_id)
  returning id into opened;
  return opened;
end;
$$;

-- A PRD folder's artifacts, pushed by the kit: `p_artifacts` is a list of {kind, content}, each kind
-- once. Finds the dossier — the draft named (P0002 when the caller cannot read it), else the one keyed
-- by the caller's workspace for the repository, `p_repo` and `p_prd`, else a new one — numbers a draft,
-- sets the title, and adds a version of each artifact by the version rule. A draft numbered to a key
-- already taken (the fallback created it first) merges into that dossier: its versions, its Claude
-- session id and its opener move over, the dossier is dated from the earlier opening, and the draft
-- goes. Returns {id, added: [{kind, version}], unchanged: [kind]}, every kind received in one of them.
-- Refused: 42501 signed out or in no workspace; 22023 a malformed call, a draft of another repository
-- or already another PRD; 54000 an artifact over 512 KiB.
create function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_title   text := btrim(coalesce(p_title, ''));
  place     uuid;
  draft     public.dossiers%rowtype;
  target    public.dossiers%rowtype;
  item      jsonb;
  kinds     text[] := '{}';
  v_version integer;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
    raise exception 'A push names its repository as owner/name.' using errcode = '22023';
  end if;
  if p_prd is null or p_prd <= 0 then
    raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 200 then
    raise exception 'A push carries a title of 1 to 200 characters.' using errcode = '22023';
  end if;
  if p_artifacts is null or jsonb_typeof(p_artifacts) <> 'array' then
    raise exception 'The artifacts are a list of {kind, content}.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_artifacts) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item ->> 'kind', '') not in ('spec', 'plan', 'before-after')
       or jsonb_typeof(item -> 'content') is distinct from 'string' then
      raise exception 'Each artifact is {kind, content}, its kind one of spec, plan, before-after.' using errcode = '22023';
    end if;
    if (item ->> 'kind') = any (kinds) then
      raise exception 'Each kind is sent once: % came twice.', item ->> 'kind' using errcode = '22023';
    end if;
    kinds := kinds || (item ->> 'kind');
  end loop;

  if p_draft is not null then
    select d.* into draft from public.dossiers d
     where d.id = p_draft and public.is_member(d.workspace_id)
       for update;
    if not found then
      raise exception 'No such draft dossier.' using errcode = 'P0002';
    end if;
    if draft.home_repo <> v_repo then
      raise exception 'This draft belongs to %.', draft.home_repo using errcode = '22023';
    end if;
    if draft.prd is not null and draft.prd <> p_prd then
      raise exception 'This dossier is already PRD #%.', draft.prd using errcode = '22023';
    end if;
    if draft.prd is not null then
      target := draft;
    else
      select d.* into target from public.dossiers d
       where d.workspace_id = draft.workspace_id and d.home_repo = v_repo and d.prd = p_prd
         for update;
      if found then
        -- Numbered to a key already taken: the draft merges into that dossier, and goes.
        update public.dossier_versions v set dossier_id = target.id where v.dossier_id = draft.id;
        update public.dossiers d
           set claude_session_id = coalesce(draft.claude_session_id, d.claude_session_id),
               opened_by = coalesce(draft.opened_by, d.opened_by),
               created_at = least(d.created_at, draft.created_at)
         where d.id = target.id;
        delete from public.dossiers d where d.id = draft.id;
      else
        update public.dossiers d set prd = p_prd, numbered_at = now() where d.id = draft.id;
        target := draft;
      end if;
    end if;
  else
    place := public.ask_session_workspace(caller, v_repo);
    if place is null then
      raise exception 'Join a workspace first: a dossier belongs to one.' using errcode = '42501';
    end if;
    insert into public.dossiers (workspace_id, home_repo, prd, title, opened_by, numbered_at)
    values (place, v_repo, p_prd, v_title, caller, now())
    on conflict (workspace_id, home_repo, prd) do nothing;
    select d.* into target from public.dossiers d
     where d.workspace_id = place and d.home_repo = v_repo and d.prd = p_prd
       for update;
  end if;

  update public.dossiers d set title = v_title where d.id = target.id;

  for item in select value from jsonb_array_elements(p_artifacts) loop
    v_version := public.dossier_add_version(target.id, item ->> 'kind', item ->> 'content', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item ->> 'kind');
    else
      added := added || jsonb_build_object('kind', item ->> 'kind', 'version', v_version);
    end if;
  end loop;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged);
end;
$$;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.dossiers enable row level security;
alter table public.dossier_versions enable row level security;

-- Reading: every member of the dossier's workspace, and nobody else.
create policy "a member reads the dossiers of their workspace" on public.dossiers
  for select to authenticated
  using (public.is_member(workspace_id));

create policy "a member reads the versions of their workspace's dossiers" on public.dossier_versions
  for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id)));

-- Deleting: the opener, their own draft only. A numbered dossier is never deleted, and there is no
-- other update or delete: writes go through the functions above.
create policy "the opener deletes their own draft" on public.dossiers
  for delete to authenticated
  using (opened_by = (select auth.uid()) and prd is null and public.is_member(workspace_id));

-- Explicit grants, and nothing more: everything revoked first, then granted per column, whether or
-- not the project grants new tables to the API roles by default (config.toml › auto_expose_new_tables).
revoke all on public.dossiers, public.dossier_versions from anon, authenticated, service_role;
grant select (id, workspace_id, home_repo, prd, title, opened_by, claude_session_id, created_at, numbered_at)
  on public.dossiers to authenticated;
grant select (id, dossier_id, kind, content, sha256, bytes, source, uploaded_by, commit_sha, git_blob, created_at)
  on public.dossier_versions to authenticated;
grant delete on public.dossiers to authenticated;
-- The fallback, as the service role: it finds or creates a dossier by its key, titles it, reads which
-- blobs it already holds, and adds versions only through dossier_add_version().
grant select on public.dossiers to service_role;
grant insert (workspace_id, home_repo, prd, title, numbered_at) on public.dossiers to service_role;
grant update (title) on public.dossiers to service_role;
grant select on public.dossier_versions to service_role;

revoke execute on function public.dossier_add_version(uuid, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.dossier_open(text, text, text) from public, anon;
revoke execute on function public.dossier_push(text, integer, text, uuid, jsonb) from public, anon;
grant execute on function public.dossier_add_version(uuid, text, text, text, uuid, text, text) to service_role;
grant execute on function public.dossier_open(text, text, text) to authenticated;
grant execute on function public.dossier_push(text, integer, text, uuid, jsonb) to authenticated;
