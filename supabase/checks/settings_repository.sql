-- Who may choose a workspace's settings repository, and what may be chosen (PRD 2543 s1). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations and the
-- demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/settings_repository.sql
-- A new workspace has none chosen. Its owner, and only its owner, chooses one through
-- set_workspace_settings_repository(): a listed repository is stored trimmed and in lower case, and the
-- call answers the saved workspace; a member and the owner of another workspace are refused (42501); a
-- repository the workspace does not list, or one it removed, is refused (P0002, hint full_name); null
-- or an empty name clears it; anyone signed out cannot run it. A refused call changes nothing, and
-- plan_repo is never touched. Nobody signed in writes the column directly. One transaction, rolled back
-- at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Ann owns Acme and Moe is a member of it; Kim owns Globex. Acme lists acme/plans and acme/app, and
-- removed acme/old. Every name is fictional.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000025a1', 'ann@acme.test', now()),
  ('00000000-0000-4000-8000-0000000025b1', 'moe@acme.test', now()),
  ('00000000-0000-4000-8000-0000000025c1', 'kim@globex.test', now());
insert into public.workspaces (slug, name, github_org, plan_repo) values
  ('acme-settings', 'Acme', 'acme', 'app'),
  ('globex-settings', 'Globex', 'globex', null);
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('acme-settings',   '00000000-0000-4000-8000-0000000025a1'::uuid, 'owner'),
         ('acme-settings',   '00000000-0000-4000-8000-0000000025b1'::uuid, 'member'),
         ('globex-settings', '00000000-0000-4000-8000-0000000025c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
insert into public.repositories (workspace_id, full_name, removed_at)
select w.id, r.full_name, r.removed_at
  from public.workspaces w
 cross join (values
   ('acme/plans', null::timestamptz),
   ('acme/app',   null),
   ('acme/old',   now())
 ) as r (full_name, removed_at)
 where w.slug = 'acme-settings';

-- The workspaces' ids, read here once: a signed-in account reads only its own workspaces.
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('acme-settings', 'globex-settings');
grant select on ids to anon, authenticated;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Runs a call that must be refused with `code`, and checks its hint when one is named.
create function pg_temp.refused(stmt text, code text, why text, want_hint text default null) returns void language plpgsql as $$
declare
  got_hint text;
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  get stacked diagnostics got_hint = pg_exception_hint;
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if want_hint is not null and got_hint is distinct from want_hint then
    raise exception 'FAIL: % hinted %, not %', why, got_hint, want_hint;
  end if;
end;
$$;
-- What Acme's row holds of the two repositories, as one value.
create function pg_temp.acme() returns text language sql as $$
  select coalesce(w.settings_repository, '(none)') || ' · plan ' || coalesce(w.plan_repo, '(none)')
    from public.workspaces w where w.slug = 'acme-settings';
$$;

-- ── A new workspace has none chosen ──
do $$
begin
  if pg_temp.acme() <> '(none) · plan app' then
    raise exception 'FAIL: a new workspace starts with a settings repository: %', pg_temp.acme();
  end if;
end $$;

-- ── Signed out: cannot run it ──
set local role anon;
select pg_temp.refused(format('select public.set_workspace_settings_repository(%L, ''acme/plans'')', pg_temp.ws('acme-settings')), '42501', 'anon choosing');
reset role;

-- ── A member, and the owner of another workspace: refused, nothing changes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025b1');
select pg_temp.refused(format('select public.set_workspace_settings_repository(%L, ''acme/plans'')', pg_temp.ws('acme-settings')), '42501', 'a member choosing');
select pg_temp.refused(format('select public.set_workspace_settings_repository(%L, null)', pg_temp.ws('acme-settings')), '42501', 'a member clearing');
select pg_temp.refused(format('update public.workspaces set settings_repository = ''acme/plans'' where id = %L', pg_temp.ws('acme-settings')), '42501', 'a member writing the column');
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025c1');
select pg_temp.refused(format('select public.set_workspace_settings_repository(%L, ''acme/plans'')', pg_temp.ws('acme-settings')), '42501', 'another workspace''s owner choosing');
reset role;

do $$
begin
  if pg_temp.acme() <> '(none) · plan app' then
    raise exception 'FAIL: a refused call changed Acme: %', pg_temp.acme();
  end if;
end $$;

-- ── The owner: an unlisted or removed repository refused, P0002 hinting full_name ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025a1');
select pg_temp.refused(format('select public.set_workspace_settings_repository(%L, ''acme/elsewhere'')', pg_temp.ws('acme-settings')), 'P0002', 'an unlisted repository', 'full_name');
select pg_temp.refused(format('select public.set_workspace_settings_repository(%L, ''acme/old'')', pg_temp.ws('acme-settings')), 'P0002', 'a removed repository', 'full_name');
select pg_temp.refused(format('select public.set_workspace_settings_repository(%L, ''globex/plans'')', pg_temp.ws('acme-settings')), 'P0002', 'another workspace''s repository', 'full_name');
select pg_temp.refused(format('update public.workspaces set settings_repository = ''acme/plans'' where id = %L', pg_temp.ws('acme-settings')), '42501', 'the owner writing the column');
reset role;

do $$
begin
  if pg_temp.acme() <> '(none) · plan app' then
    raise exception 'FAIL: a refused choice changed Acme: %', pg_temp.acme();
  end if;
end $$;

-- ── The owner chooses acme/plans, in any case, and the call answers the saved row ──
create temporary table saved (round int primary key, w public.workspaces);
grant insert, select on saved to authenticated;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025a1');
insert into saved values (1, public.set_workspace_settings_repository(pg_temp.ws('acme-settings'), '  Acme/Plans '));
reset role;

do $$
declare
  w public.workspaces := (select s.w from saved s where s.round = 1);
begin
  if w.id is distinct from pg_temp.ws('acme-settings') or w.settings_repository is distinct from 'acme/plans' then
    raise exception 'FAIL: the call did not answer Acme choosing acme/plans: %', w;
  end if;
  if pg_temp.acme() <> 'acme/plans · plan app' then
    raise exception 'FAIL: the owner''s choice was not stored as acme/plans, plan_repo kept: %', pg_temp.acme();
  end if;
end $$;

-- ── Null clears it, and so does an empty name ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000025a1');
insert into saved values (2, public.set_workspace_settings_repository(pg_temp.ws('acme-settings'), null));
insert into saved values (3, public.set_workspace_settings_repository(pg_temp.ws('acme-settings'), 'acme/app'));
insert into saved values (4, public.set_workspace_settings_repository(pg_temp.ws('acme-settings'), '   '));
reset role;

do $$
begin
  if (select (s.w).settings_repository from saved s where s.round = 2) is not null then
    raise exception 'FAIL: null did not clear the choice';
  end if;
  if (select (s.w).settings_repository from saved s where s.round = 3) is distinct from 'acme/app' then
    raise exception 'FAIL: the owner could not choose again after clearing';
  end if;
  if pg_temp.acme() <> '(none) · plan app' then
    raise exception 'FAIL: an empty name did not clear the choice: %', pg_temp.acme();
  end if;
end $$;

rollback;
