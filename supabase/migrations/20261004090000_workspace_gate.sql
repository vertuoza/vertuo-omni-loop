-- Membership is the only gate (PRD 459, docs: .omni-loop/delivery/inbox/0459-workspace-gate/spec.md).
-- Every terminal call names its repository (owner/name), and one function says where it goes, for a
-- person and that repository:
--
--   the repository's owner is…                        the call goes…
--   a workspace the person belongs to                  to that workspace
--   a workspace the person does not belong to          nowhere: "you are not a member of <workspace>, which owns <repo>"
--   no workspace at all                                to the workspace the person joined first (the fallback)
--   no workspace, and the person belongs to none       nowhere: "no workspace owns <repo> yet — install the Omni App"
--
-- "Owns" is workspaces.github_org equal to the repository's owner, case-insensitive (PRD 144's match).
-- The app adds the App's install link after the second refusal: the link is the deployment's, not the
-- database's. Before this, ask_session_workspace() sent a repository another workspace owns to the
-- caller's first workspace; it goes, and the ask-session trigger, dossier_open() and dossier_push()
-- ask repo_workspace() instead, and refuse with its reason (42501, insufficient_privilege).
--
-- Proven by supabase/checks/ask.sql and supabase/checks/dossiers.sql.
-- Rollback: a follow-up migration restores ask_session_workspace() (20260927100000_ask_workspace.sql)
-- and makes the trigger and the two dossier functions call it again. No data changes shape.

-- ── Where a call goes ────────────────────────────────────────────────────────────

-- The workspace a call of `person` for `repo` goes to, or, when it goes nowhere, why: exactly one of
-- the two is null. A null or empty `repo` is owned by no workspace, so it takes the fallback.
create function public.repo_workspace(person uuid, repo text, out workspace_id uuid, out refusal text)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_repo  text := btrim(coalesce(repo, ''));
  v_owner text := lower(split_part(btrim(coalesce(repo, '')), '/', 1));
  shown   text := coalesce(nullif(btrim(coalesce(repo, '')), ''), 'this repository');
  owning  text;
begin
  -- A workspace the person belongs to owns it.
  select m.workspace_id into workspace_id
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
   where m.user_id = person and v_owner <> '' and lower(w.github_org) = v_owner
   order by m.joined_at, w.slug
   limit 1;
  if workspace_id is not null then
    return;
  end if;

  -- A workspace the person does not belong to owns it.
  select w.name into owning
    from public.workspaces w
   where v_owner <> '' and lower(w.github_org) = v_owner
   order by w.created_at, w.slug
   limit 1;
  if owning is not null then
    refusal := format('you are not a member of %s, which owns %s', owning, shown);
    return;
  end if;

  -- No workspace owns it: the one the person joined first, if any.
  select m.workspace_id into workspace_id
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
   where m.user_id = person
   order by m.joined_at, w.slug
   limit 1;
  if workspace_id is null then
    refusal := format('no workspace owns %s yet — install the Omni App', shown);
  end if;
end;
$$;

revoke execute on function public.repo_workspace(uuid, text) from public, anon, authenticated;

-- ── An ask session ───────────────────────────────────────────────────────────────

-- Nobody sends a session's workspace: the database picks it as the session opens, or refuses the
-- session with the reason.
create or replace function public.ask_sessions_place() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pick record;
begin
  select * into pick from public.repo_workspace(new.owner, new.repo);
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;
  new.workspace_id := pick.workspace_id;
  return new;
end;
$$;

revoke execute on function public.ask_sessions_place() from public, anon, authenticated;

-- ── The kit's two dossier calls ──────────────────────────────────────────────────

-- As 20260928090000_dossiers.sql, but the draft goes where repo_workspace() says, or is refused with
-- its reason.
create or replace function public.dossier_open(p_title text, p_repo text, p_claude_session_id text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  v_repo  text := lower(btrim(coalesce(p_repo, '')));
  v_title text := btrim(coalesce(p_title, ''));
  pick    record;
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
  select * into pick from public.repo_workspace(caller, v_repo);
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;
  insert into public.dossiers (workspace_id, home_repo, title, opened_by, claude_session_id)
  values (pick.workspace_id, v_repo, v_title, caller, p_claude_session_id)
  returning id into opened;
  return opened;
end;
$$;

-- As 20260928090000_dossiers.sql, but a push with no draft goes where repo_workspace() says, or is
-- refused with its reason. A push to a draft goes to the draft's workspace, as before.
create or replace function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_title   text := btrim(coalesce(p_title, ''));
  pick      record;
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
    select * into pick from public.repo_workspace(caller, v_repo);
    if pick.workspace_id is null then
      raise exception '%', pick.refusal using errcode = '42501';
    end if;
    insert into public.dossiers (workspace_id, home_repo, prd, title, opened_by, numbered_at)
    values (pick.workspace_id, v_repo, p_prd, v_title, caller, now())
    on conflict (workspace_id, home_repo, prd) do nothing;
    select d.* into target from public.dossiers d
     where d.workspace_id = pick.workspace_id and d.home_repo = v_repo and d.prd = p_prd
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

-- ── The old pick goes ────────────────────────────────────────────────────────────

drop function public.ask_session_workspace(uuid, text);

comment on column public.ask_sessions.workspace_id is
  'The workspace whose members read the session and its rounds. Set when it opens (repo_workspace()), never sent.';
