-- One-click sign-up with GitHub (PRD 359, docs: .omni-loop/delivery/inbox/0359-github-sign-up/spec.md).
-- GitHub becomes the only way in, and installing the omni-loop App is how a workspace is born.
--
-- Additive: the sign-up hook now lets in any GitHub account, with or without an email, and refuses
-- every other provider; a workspace records the App installation it came from; a table holds the
-- sign-up requests of visitors waiting for their org's owner; and two functions, run by galaxy's
-- server as the service role only, make a workspace from an installation and join a person to the
-- workspaces of their GitHub orgs. join_domain and join_by_domain() go in a migration of their own
-- (20261001100000), once galaxy no longer calls them.
--
-- Proven by supabase/checks/signup.sql.
-- Rollback: a follow-up migration restores the domain hook of 20260926120000_workspaces.sql, and drops
-- the two functions, signup_requests and the two workspace columns.

-- ── 1. The sign-up hook: GitHub only ─────────────────────────────────────────────

-- Same name and signature, so the dashboard's setting (Authentication › Hooks) still points at it.
-- Supabase Auth passes the user it is about to create; its app_metadata names the provider. A GitHub
-- account whose email is hidden has none, and is let in all the same.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql immutable
set search_path = ''
as $$
begin
  if event -> 'user' -> 'app_metadata' ->> 'provider' = 'github' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Omni Loop signs in with GitHub only.'));
end;
$$;

-- `create or replace` keeps the grants: supabase_auth_admin only (20260926120000_workspaces.sql).

-- ── 2. A workspace remembers the installation it came from ─────────────────────────

alter table public.workspaces
  add column github_installation_id bigint unique check (github_installation_id > 0),
  add column github_account_type    text check (github_account_type in ('Organization', 'User'));

comment on column public.workspaces.github_installation_id is
  'The omni-loop App installation this workspace owns. Its members join by GitHub org only once it is set.';
comment on column public.workspaces.github_account_type is
  'What github_org is on GitHub: an Organization, or a User''s personal account (a solo workspace).';

-- ── 3. Sign-up requests: a visitor waiting for their org's owner ───────────────────

create table public.signup_requests (
  user_id    uuid not null references auth.users on delete cascade,
  github_org text not null check (github_org ~ '^[A-Za-z0-9-]{1,39}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, github_org)
);

comment on table public.signup_requests is
  'A visitor who asked their org''s owner to install Omni Loop. Completed at their next sign-in once the org has the App. Written by the service role.';

alter table public.signup_requests enable row level security;

create policy "a person reads their own sign-up requests" on public.signup_requests
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.signup_requests from public, anon, authenticated, service_role;
grant select on public.signup_requests to authenticated;
grant select, insert, delete on public.signup_requests to service_role;

-- ── 4. Making a workspace from an installation ───────────────────────────────────

-- galaxy's /signup/installed calls it once it has fetched the installation from GitHub with the App's
-- JWT and checked the visitor against its account: never from an installation id alone. One workspace
-- per GitHub account:
--   - an installation already recorded: the person joins its workspace (a replay creates nothing);
--   - an account that already has a workspace (github_org, any case): the installation is recorded on
--     it when it has none, and the person joins it as a member, never as a second owner;
--   - otherwise a new workspace, named after the login and slugged by it lowercased (a free slug when
--     that one is taken or invalid), with the person as its owner. It starts empty.
-- Answers {workspace_id, slug, role, created}: the person's role in it, and whether it is new.
create function public.create_workspace_from_installation(
  p_user_id uuid, p_installation_id bigint, p_login text, p_type text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws public.workspaces;
  made boolean := false;
  base text;
  candidate text;
  n integer := 1;
  my_role text;
begin
  if p_user_id is null or p_installation_id is null or p_installation_id <= 0
     or p_login is null or p_login !~ '^[A-Za-z0-9-]{1,39}$'
     or p_type is null or p_type not in ('Organization', 'User') then
    raise exception 'A workspace needs a person, an installation id, a GitHub login and its account type.'
      using errcode = '22023';
  end if;

  -- Two calls for one account (a double click, a replay) never race to two workspaces.
  perform pg_advisory_xact_lock(hashtext('create_workspace_from_installation:' || lower(p_login)));

  select * into ws from public.workspaces w where w.github_installation_id = p_installation_id;
  if not found then
    select * into ws from public.workspaces w
     where lower(w.github_org) = lower(p_login)
     order by w.created_at
     limit 1;
    if found then
      if ws.github_installation_id is null then
        update public.workspaces w
           set github_installation_id = p_installation_id, github_account_type = p_type
         where w.id = ws.id;
      end if;
    else
      base := left(lower(p_login), 32);
      candidate := base;
      while candidate !~ '^[a-z0-9-]{2,32}$'
            or exists (select 1 from public.workspaces w where w.slug = candidate) loop
        n := n + 1;
        candidate := left(base, 32 - 1 - length(n::text)) || '-' || n;
      end loop;
      insert into public.workspaces (slug, name, github_org, github_installation_id, github_account_type)
      values (candidate, p_login, p_login, p_installation_id, p_type)
      returning * into ws;
      made := true;
    end if;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws.id, p_user_id, case when made then 'owner' else 'member' end)
  on conflict (workspace_id, user_id) do nothing;

  select m.role into my_role from public.workspace_members m where m.workspace_id = ws.id and m.user_id = p_user_id;
  return jsonb_build_object('workspace_id', ws.id, 'slug', ws.slug, 'role', my_role, 'created', made);
end;
$$;

-- ── 5. Joining by GitHub org ─────────────────────────────────────────────────────

-- galaxy's sign-in callback calls it with the person's GitHub login and the logins of their orgs,
-- read from GitHub once and never stored. Adds the person as a member of every workspace whose
-- github_org is one of them, in any case, and that has an installation. Idempotent; an owner stays
-- owner. Answers the slugs of every workspace the person belongs to, the one joined first first.
create function public.join_workspaces_by_github(p_user_id uuid, p_logins text[]) returns text[]
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'Joining needs a person.' using errcode = '22023';
  end if;
  insert into public.workspace_members (workspace_id, user_id)
  select w.id, p_user_id
    from public.workspaces w
   where w.github_installation_id is not null
     and lower(w.github_org) in (select lower(l) from unnest(coalesce(p_logins, '{}')) l)
  on conflict (workspace_id, user_id) do nothing;
  return array(
    select w.slug
      from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
     where m.user_id = p_user_id
     order by m.joined_at, w.slug);
end;
$$;

-- ── Who may run them: galaxy's server, as the service role, and nobody else ────────

revoke execute on function public.create_workspace_from_installation(uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.create_workspace_from_installation(uuid, bigint, text, text) to service_role;
revoke execute on function public.join_workspaces_by_github(uuid, text[]) from public, anon, authenticated;
grant execute on function public.join_workspaces_by_github(uuid, text[]) to service_role;
