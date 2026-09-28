-- Who may sign up, and how a workspace is born (PRD 359). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/signup.sql
-- The sign-up hook lets in any GitHub account, with or without an email, and nothing else. Installing
-- the omni-loop App makes a workspace (create_workspace_from_installation), and a GitHub org's members
-- join the workspaces of their orgs (join_workspaces_by_github). Only the service role runs either;
-- nobody signed in writes a workspace, a membership or a sign-up request, and a person reads only
-- their own requests. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The sign-up hook: GitHub, with or without an email, and nothing else ──
do $$
declare refusal jsonb;
begin
  if public.hook_before_user_created(
       '{"user": {"email": "ada@example.com", "app_metadata": {"provider": "github", "providers": ["github"]}}}') <> '{}'::jsonb then
    raise exception 'FAIL: the hook refused a GitHub account with an email';
  end if;
  if public.hook_before_user_created(
       '{"user": {"email": "", "app_metadata": {"provider": "github", "providers": ["github"]}}}') <> '{}'::jsonb then
    raise exception 'FAIL: the hook refused a GitHub account with no email';
  end if;
  if public.hook_before_user_created('{"user": {"app_metadata": {"provider": "github"}}}') <> '{}'::jsonb then
    raise exception 'FAIL: the hook refused a GitHub account whose email is absent';
  end if;
  foreach refusal in array array[
    '{"user": {"email": "ada@vertuoza.com", "app_metadata": {"provider": "google", "providers": ["google"]}}}',
    '{"user": {"email": "ada@vertuoza.com", "app_metadata": {"provider": "email", "providers": ["email"]}}}',
    '{"user": {"email": "ada@vertuoza.com"}}'
  ]::jsonb[] loop
    refusal := public.hook_before_user_created(refusal);
    if refusal -> 'error' ->> 'http_code' is distinct from '403'
       or refusal -> 'error' ->> 'message' is distinct from 'Omni Loop signs in with GitHub only.' then
      raise exception 'FAIL: the hook let in, or refused wrongly, an account of another provider: %', refusal;
    end if;
  end loop;
  if has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute')
     or not has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute') then
    raise exception 'FAIL: the hook is callable by the wrong roles';
  end if;
end $$;

-- ── The cast ──
-- Ada administers the acme org; Bob belongs to it; Cleo has no org; Dan is in no workspace's org.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000005a1', 'ada@acme.test', now()),
  ('00000000-0000-4000-8000-0000000005b2', null, null),                -- a hidden email
  ('00000000-0000-4000-8000-0000000005c3', 'cleo@example.com', now()),
  ('00000000-0000-4000-8000-0000000005d4', 'dan@example.com', now()),
  ('00000000-0000-4000-8000-0000000005e5', 'eli@vertuoza.com', now());

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.role_in(slug text, uid uuid) returns text language sql as $$
  select m.role from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
   where w.slug = role_in.slug and m.user_id = role_in.uid;
$$;

-- ── Installing the App makes a workspace (as the service role, like galaxy's /signup/installed) ──
set local role service_role;
do $$
declare
  ada  constant uuid := '00000000-0000-4000-8000-0000000005a1';
  bob  constant uuid := '00000000-0000-4000-8000-0000000005b2';
  cleo constant uuid := '00000000-0000-4000-8000-0000000005c3';
  eli  constant uuid := '00000000-0000-4000-8000-0000000005e5';
  before_count bigint;
  made jsonb;
  w public.workspaces;
begin
  -- A new org: its workspace, named after it, with Ada as owner.
  made := public.create_workspace_from_installation(ada, 5001, 'Acme-Corp', 'Organization');
  select * into w from public.workspaces where slug = 'acme-corp';
  if not found or (w.name, w.github_org, w.github_installation_id, w.github_account_type)
       is distinct from ('Acme-Corp'::text, 'Acme-Corp'::text, 5001::bigint, 'Organization'::text) then
    raise exception 'FAIL: a new org''s workspace is not as the spec sets it: %', row_to_json(w);
  end if;
  if pg_temp.role_in('acme-corp', ada) is distinct from 'owner' then
    raise exception 'FAIL: the installer of a new org is not its workspace''s owner';
  end if;
  if (made ->> 'slug', made ->> 'role', (made ->> 'created')::boolean, (made ->> 'workspace_id')::uuid)
       is distinct from ('acme-corp'::text, 'owner'::text, true, w.id) then
    raise exception 'FAIL: create_workspace_from_installation answered %', made;
  end if;

  -- The same installation again (a reload, a replay): nothing new, and Ada stays owner.
  select count(*) into before_count from public.workspaces;
  made := public.create_workspace_from_installation(ada, 5001, 'Acme-Corp', 'Organization');
  if (select count(*) from public.workspaces) <> before_count
     or pg_temp.role_in('acme-corp', ada) is distinct from 'owner'
     or (made ->> 'created')::boolean or made ->> 'role' <> 'owner' then
    raise exception 'FAIL: a replayed installation changed something: %', made;
  end if;

  -- Bob replays Ada's installation: he joins as a member, never a second owner.
  made := public.create_workspace_from_installation(bob, 5001, 'Acme-Corp', 'Organization');
  if (select count(*) from public.workspaces) <> before_count
     or pg_temp.role_in('acme-corp', bob) is distinct from 'member' or made ->> 'role' <> 'member' then
    raise exception 'FAIL: a second person on an installed org did not join as a member: %', made;
  end if;

  -- Vertuoza has a workspace and no installation: the installation is recorded on it, and Eli joins
  -- as a member. No second workspace.
  made := public.create_workspace_from_installation(eli, 7007, 'vertuoza', 'Organization');
  select * into w from public.workspaces where slug = 'vertuoza';
  if (select count(*) from public.workspaces) <> before_count
     or (w.github_installation_id, w.github_account_type) is distinct from (7007::bigint, 'Organization'::text)
     or pg_temp.role_in('vertuoza', eli) is distinct from 'member'
     or (made ->> 'slug', made ->> 'role', (made ->> 'created')::boolean) is distinct from ('vertuoza'::text, 'member'::text, false) then
    raise exception 'FAIL: installing on vertuoza did not record the installation on its workspace: % %', row_to_json(w), made;
  end if;
  -- Another installation on an account that already has one never replaces it.
  made := public.create_workspace_from_installation(cleo, 7008, 'VERTUOZA', 'Organization');
  if (select github_installation_id from public.workspaces where slug = 'vertuoza') <> 7007
     or (select count(*) from public.workspaces) <> before_count then
    raise exception 'FAIL: a second installation replaced vertuoza''s';
  end if;
  delete from public.workspace_members where user_id = cleo;

  -- A personal account: a solo workspace named after the login.
  made := public.create_workspace_from_installation(cleo, 6001, 'cleo', 'User');
  select * into w from public.workspaces where slug = 'cleo';
  if not found or (w.name, w.github_org, w.github_installation_id, w.github_account_type)
       is distinct from ('cleo'::text, 'cleo'::text, 6001::bigint, 'User'::text)
     or pg_temp.role_in('cleo', cleo) is distinct from 'owner' then
    raise exception 'FAIL: a personal account''s solo workspace is not as the spec sets it: %', row_to_json(w);
  end if;

  -- A slug already taken by another account's workspace: the new one gets a free slug of its own.
  update public.workspaces set github_org = 'someone-else' where slug = 'cleo';
  made := public.create_workspace_from_installation(ada, 6002, 'Cleo', 'User');
  if made ->> 'slug' is not distinct from 'cleo' or (made ->> 'created')::boolean is not true
     or (select github_org from public.workspaces where slug = made ->> 'slug') <> 'Cleo'
     or (select github_org from public.workspaces where slug = 'cleo') <> 'someone-else' then
    raise exception 'FAIL: a colliding slug was not given a free one: %', made;
  end if;
  -- A one-letter login, and one longer than a slug may be: still a valid slug.
  made := public.create_workspace_from_installation(ada, 6003, 'x', 'User');
  if made ->> 'slug' !~ '^[a-z0-9-]{2,32}$' then raise exception 'FAIL: a one-letter login made slug %', made; end if;
  made := public.create_workspace_from_installation(ada, 6004, 'a-very-long-github-organisation-login-9', 'Organization');
  if made ->> 'slug' !~ '^[a-z0-9-]{2,32}$' then raise exception 'FAIL: a long login made slug %', made; end if;

  -- Nonsense is refused, and makes nothing.
  select count(*) into before_count from public.workspaces;
  begin
    perform public.create_workspace_from_installation(ada, 6005, 'acme', 'Enterprise');
    raise exception 'FAIL: an unknown account type was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_workspace_from_installation(ada, 6006, 'not a login!', 'Organization');
    raise exception 'FAIL: a malformed login was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_workspace_from_installation(ada, 0, 'acme', 'Organization');
    raise exception 'FAIL: installation id 0 was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_workspace_from_installation(null, 6007, 'acme', 'Organization');
    raise exception 'FAIL: a workspace was made for nobody';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.workspaces) <> before_count then
    raise exception 'FAIL: a refused call made a workspace';
  end if;
end $$;

-- ── Joining by GitHub org: exactly the installed workspaces of the given logins ──
do $$
declare
  dan  constant uuid := '00000000-0000-4000-8000-0000000005d4';
  bob  constant uuid := '00000000-0000-4000-8000-0000000005b2';
  joined text[];
begin
  -- An org whose workspace has no installation: joining it is not open.
  insert into public.workspaces (slug, name, github_org) values ('quiet', 'Quiet', 'quiet-org');

  joined := public.join_workspaces_by_github(dan, array['ACME-corp', 'quiet-org', 'unknown-org', 'dan']);
  if joined is distinct from array['acme-corp'] then
    raise exception 'FAIL: join_workspaces_by_github answered % for acme-corp, quiet-org, unknown-org', joined;
  end if;
  if pg_temp.role_in('acme-corp', dan) is distinct from 'member' or pg_temp.role_in('quiet', dan) is not null then
    raise exception 'FAIL: joining by org did not add exactly the installed workspace';
  end if;
  -- Again: idempotent, and it answers every workspace of the person, first joined first.
  joined := public.join_workspaces_by_github(dan, array['acme-corp', 'Vertuoza']);
  if joined is distinct from array['acme-corp', 'vertuoza'] or pg_temp.role_in('vertuoza', dan) is distinct from 'member' then
    raise exception 'FAIL: a second join answered %', joined;
  end if;
  -- An owner stays owner.
  perform public.join_workspaces_by_github('00000000-0000-4000-8000-0000000005a1', array['acme-corp']);
  if pg_temp.role_in('acme-corp', '00000000-0000-4000-8000-0000000005a1') is distinct from 'owner' then
    raise exception 'FAIL: joining demoted an owner';
  end if;
  -- No orgs, or null: nothing joined, the person's workspaces answered.
  if public.join_workspaces_by_github(bob, '{}') is distinct from array['acme-corp']
     or public.join_workspaces_by_github(bob, null) is distinct from array['acme-corp'] then
    raise exception 'FAIL: joining with no orgs changed something';
  end if;
  begin
    perform public.join_workspaces_by_github(null, array['acme-corp']);
    raise exception 'FAIL: nobody joined a workspace';
  exception when invalid_parameter_value then null; end;

  -- The service role records sign-up requests.
  insert into public.signup_requests (user_id, github_org) values
    (dan, 'waiting-org'), (bob, 'waiting-org');
end $$;
reset role;

-- ── Nobody signed in or out runs either function, or writes a workspace, a membership or a request ──
do $$
declare t text; f text;
begin
  foreach f in array array[
    'public.create_workspace_from_installation(uuid, bigint, text, text)',
    'public.join_workspaces_by_github(uuid, text[])'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
       or not has_function_privilege('service_role', f, 'execute') then
      raise exception 'FAIL: % is callable by the wrong roles', f;
    end if;
  end loop;
  foreach t in array array['public.workspaces', 'public.workspace_members', 'public.signup_requests'] loop
    if has_table_privilege('anon', t, 'insert, update, delete, truncate')
       or has_table_privilege('authenticated', t, 'insert, update, delete, truncate') then
      raise exception 'FAIL: a signed-in user may edit %', t;
    end if;
  end loop;
end $$;

set local role authenticated;
do $$
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000005a1');
  begin
    perform public.create_workspace_from_installation(auth.uid(), 9001, 'mine', 'User');
    raise exception 'FAIL: a signed-in user made a workspace';
  exception when insufficient_privilege then null; end;
  begin
    perform public.join_workspaces_by_github(auth.uid(), array['quiet-org']);
    raise exception 'FAIL: a signed-in user joined by org';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.signup_requests (user_id, github_org) values (auth.uid(), 'acme-corp');
    raise exception 'FAIL: a signed-in user recorded a sign-up request';
  exception when insufficient_privilege then null; end;

  -- A person reads their own sign-up requests, and nobody else's.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000005d4');
  if (select count(*) from public.signup_requests) <> 1
     or exists (select 1 from public.signup_requests where user_id <> auth.uid()) then
    raise exception 'FAIL: a person read another''s sign-up requests';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000005c3');
  if exists (select 1 from public.signup_requests) then
    raise exception 'FAIL: a person with no request read one';
  end if;
end $$;
reset role;

set local role anon;
do $$
begin
  perform 1 from public.signup_requests limit 1;
  raise exception 'FAIL: anon read the sign-up requests';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'sign-up checks passed' as result;
rollback;
