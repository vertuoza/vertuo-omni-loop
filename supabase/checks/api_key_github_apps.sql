-- Who may attach, replace, remove and read an API key's GitHub App, and which runner takes the jobs of a key
-- that holds one (PRD 2433 s1, 20261228090000_api_key_github_apps.sql). The supabase workflow runs it on
-- every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/api_key_github_apps.sql
-- Only an owner of the key's workspace attaches, replaces or removes an App, on a live `api` key (42501
-- otherwise; a bad value is 22023). Any member lists the slug of each key's App, never the sealed key, the
-- iv or `last_token_at`, which an owner reads; no one signed in selects either table, an owner included;
-- another workspace's member reads none of it. Revoking the key, by api_key_revoke() or by
-- agent_token_revoke(), deletes its row, and so does Remove. The service role alone opens a job's App
-- (api_key_github_app_of_job()) and records its mint. runner_claim() gives a job of a key with an App to a
-- runner that registered `githubApp` and never to another; a job queued while the key held an App stays
-- one after the App is removed or the key revoked, and a job queued while it held none is not.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Ada owns Northwind; Ben is its member, Cleo its second owner; Dan owns Southwind.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000024a1', 'ada@northwind-apps.test', now()),
  ('00000000-0000-4000-8000-0000000024b1', 'ben@northwind-apps.test', now()),
  ('00000000-0000-4000-8000-0000000024a2', 'cleo@northwind-apps.test', now()),
  ('00000000-0000-4000-8000-0000000024c1', 'dan@southwind-apps.test', now());
insert into public.workspaces (slug, name, github_org) values
  ('northwind-apps', 'Northwind', 'northwind-apps'),
  ('southwind-apps', 'Southwind', 'southwind-apps');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('northwind-apps', '00000000-0000-4000-8000-0000000024a1'::uuid, 'owner'),
         ('northwind-apps', '00000000-0000-4000-8000-0000000024b1'::uuid, 'member'),
         ('northwind-apps', '00000000-0000-4000-8000-0000000024a2'::uuid, 'owner'),
         ('southwind-apps', '00000000-0000-4000-8000-0000000024c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('northwind-apps', 'southwind-apps');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The keys, runners and jobs made here, by name.
create temporary table keys (name text primary key, id uuid);
create temporary table runner_ids (name text primary key, id uuid);
create temporary table job_ids (name text primary key, id uuid);
grant select, insert, update on keys, runner_ids, job_ids to anon, authenticated, service_role;
create function pg_temp.kid(name text) returns uuid language sql as $$
  select k.id from keys k where k.name = kid.name;
$$;
create function pg_temp.rid(name text) returns uuid language sql as $$
  select r.id from runner_ids r where r.name = rid.name;
$$;
create function pg_temp.jid(name text) returns uuid language sql as $$
  select j.id from job_ids j where j.name = jid.name;
$$;
-- Runs a call that must be refused with `state`.
create function pg_temp.refused(stmt text, state text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute stmt;
  exception when others then
    got := sqlstate;
  end;
  if got is distinct from state then
    raise exception 'FAIL: % answered % (want %)', stmt, coalesce(got, 'success'), state;
  end if;
end;
$$;
-- Makes an API key as whoever is signed in, and keeps it under `name`.
create function pg_temp.make(name text, slug text) returns uuid language plpgsql as $$
declare made uuid;
begin
  made := public.api_key_make(pg_temp.ws(slug), name, '{}', encode(sha256(convert_to(make.name, 'UTF8')), 'hex'), 'abcd');
  insert into keys values (make.name, made);
  return made;
end;
$$;
-- Attaches an App to a kept key as whoever is signed in: the sealed key and iv are placeholders, never a real key.
create function pg_temp.attach(key_name text, app_id bigint, slug text, bot_id bigint) returns jsonb language sql as $$
  select public.api_key_github_app_attach(pg_temp.kid(attach.key_name), attach.app_id, attach.slug, attach.bot_id,
                                          'sealed-for-' || attach.slug, 'iv-for-' || attach.slug);
$$;
-- Queues a job of a kept key (null: a person's) as the superuser, `minutes` ago.
create function pg_temp.queue(job text, key_name text, minutes integer) returns uuid language plpgsql as $$
declare made uuid;
begin
  insert into public.runner_jobs (workspace_id, line, repo, sent_by, sent_by_key, queued_at)
  values (pg_temp.ws('northwind-apps'), '/omni:bug-fix ''' || queue.job || '''', 'northwind-apps/web',
          '00000000-0000-4000-8000-0000000024a1', pg_temp.kid(queue.key_name), now() - make_interval(mins => queue.minutes))
  returning id into made;
  insert into job_ids values (queue.job, made);
  return made;
end;
$$;
-- The id of the job `runner` claims now, or 'none'.
create function pg_temp.claims(runner text) returns text language sql as $$
  select coalesce((select j.id::text from public.runner_claim(pg_temp.rid(claims.runner)) j), 'none');
$$;
-- True when the job is marked as needing an App.
create function pg_temp.marked(job text) returns boolean language sql as $$
  select exists (select 1 from public.runner_job_needs_app n where n.job_id = pg_temp.jid(marked.job));
$$;

-- Two runners of Northwind's: one that can run a job as an App, one that cannot (an older kit).
insert into public.runners (workspace_id, owner, name, slots, repos, github_app)
values (pg_temp.ws('northwind-apps'), '00000000-0000-4000-8000-0000000024a1', 'plain-box', 8, '{northwind-apps/web}', false),
       (pg_temp.ws('northwind-apps'), '00000000-0000-4000-8000-0000000024a1', 'app-box', 8, '{northwind-apps/web}', true);
insert into runner_ids select r.name, r.id from public.runners r where r.workspace_id = pg_temp.ws('northwind-apps');
do $$
begin
  if (select github_app from public.runners where id = pg_temp.rid('plain-box')) is not false
     or (select github_app from public.runners where id = pg_temp.rid('app-box')) is not true then
    raise exception 'FAIL: a runner does not keep what it registered for githubApp';
  end if;
end $$;

-- The keys: Ada makes five for Northwind and an agent link, Dan one for Southwind.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
select pg_temp.make('Weekly digest', 'northwind-apps'),
       pg_temp.make('QA dashboard', 'northwind-apps'),
       pg_temp.make('Third key', 'northwind-apps'),
       pg_temp.make('Fourth key', 'northwind-apps'),
       pg_temp.make('Fifth key', 'northwind-apps');
insert into keys select 'Editor', (public.agent_token_make(pg_temp.ws('northwind-apps'), 'Editor', repeat('e', 64), 'itor')->>'id')::uuid;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024c1');
select pg_temp.make('Southwind tool', 'southwind-apps');
reset role;

-- ── Signed out: no function runs, no table is read ──
set local role anon;
select pg_temp.sign_out();
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Weekly digest')),
    format('select public.api_key_github_app_remove(%L)', pg_temp.kid('Weekly digest')),
    format('select public.api_key_github_apps_list(%L)', pg_temp.ws('northwind-apps')),
    format('select public.api_key_github_app_of_job(%L)', gen_random_uuid()),
    format('select public.api_key_github_app_minted(%L)', pg_temp.kid('Weekly digest')),
    'select 1 from public.api_key_github_apps',
    'select 1 from public.runner_job_needs_app'
  ] loop perform pg_temp.refused(c, '42501'); end loop;
end $$;
reset role;

-- ── Only an owner of the key's workspace attaches or removes an App ──
set local role authenticated;
do $$
declare c text;
begin
  -- Ben, a member, may not; nor may Dan, another workspace's owner; nobody attaches to a key nobody made.
  foreach c in array array['00000000-0000-4000-8000-0000000024b1', '00000000-0000-4000-8000-0000000024c1'] loop
    perform pg_temp.sign_in(c);
    perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Weekly digest')), '42501');
    perform pg_temp.refused(format('select public.api_key_github_app_remove(%L)', pg_temp.kid('Weekly digest')), '42501');
  end loop;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', ''i'')', gen_random_uuid()), '42501');
  perform pg_temp.refused(format('select public.api_key_github_app_remove(%L)', gen_random_uuid()), '42501');
  -- Not even an owner attaches an App to an agent link, which is no API key.
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Editor')), '42501');
  perform pg_temp.refused(format('select public.api_key_github_app_remove(%L)', pg_temp.kid('Editor')), '42501');
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.api_key_github_apps) then
    raise exception 'FAIL: a refused call stored an App';
  end if;
end $$;

-- ── An owner attaches: the pair is stored as given, the sealed key never returned ──
set local role authenticated;
do $$
declare got jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
  -- Each value has its shape, its field in the hint.
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 0, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Weekly digest')), '22023');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, null, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Weekly digest')), '22023');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''Not A Slug'', 2, ''c'', ''i'')', pg_temp.kid('Weekly digest')), '22023');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, '''', 2, ''c'', ''i'')', pg_temp.kid('Weekly digest')), '22023');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 0, ''c'', ''i'')', pg_temp.kid('Weekly digest')), '22023');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, '''', ''i'')', pg_temp.kid('Weekly digest')), '22023');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', null)', pg_temp.kid('Weekly digest')), '22023');

  got := pg_temp.attach('Weekly digest', 4001, 'northwind-bot', 90001);
  if got <> jsonb_build_object('keyId', pg_temp.kid('Weekly digest'), 'slug', 'northwind-bot', 'lastTokenAt', null) then
    raise exception 'FAIL: attaching answered %', got;
  end if;
  if got::text like '%sealed-for-%' or got::text like '%iv-for-%' then
    raise exception 'FAIL: attaching answered the sealed key';
  end if;
end $$;
reset role;
do $$
declare g public.api_key_github_apps;
begin
  select * into g from public.api_key_github_apps where key_id = pg_temp.kid('Weekly digest');
  if g.workspace_id <> pg_temp.ws('northwind-apps') or g.app_id <> 4001 or g.slug <> 'northwind-bot' or g.bot_id <> 90001
     or g.ciphertext <> 'sealed-for-northwind-bot' or g.iv <> 'iv-for-northwind-bot'
     or g.attached_by <> '00000000-0000-4000-8000-0000000024a1' or g.attached_at is null or g.last_token_at is not null then
    raise exception 'FAIL: the App is not stored as attached: %', g;
  end if;
end $$;

-- ── Any member lists the slug; an owner also reads `last token`; nobody reads the sealed key ──
set local role authenticated;
do $$
declare listed jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024b1');
  listed := public.api_key_github_apps_list(pg_temp.ws('northwind-apps'));
  if listed <> jsonb_build_array(jsonb_build_object('keyId', pg_temp.kid('Weekly digest'), 'slug', 'northwind-bot')) then
    raise exception 'FAIL: Ben read the Apps as %', listed;
  end if;
  if listed::text like '%sealed%' or listed::text ~* '(ciphertext|iv|lastTokenAt|last_token_at)' then
    raise exception 'FAIL: a member read what only an owner, or no one, reads: %', listed;
  end if;

  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
  listed := public.api_key_github_apps_list(pg_temp.ws('northwind-apps'));
  if listed <> jsonb_build_array(jsonb_build_object('keyId', pg_temp.kid('Weekly digest'), 'slug', 'northwind-bot', 'lastTokenAt', null)) then
    raise exception 'FAIL: Ada read the Apps as %', listed;
  end if;
  if listed::text like '%sealed%' or listed::text ~* '(ciphertext|"iv")' then
    raise exception 'FAIL: an owner read the sealed key: %', listed;
  end if;

  -- Another workspace's member reads none of Northwind's, and Southwind holds no App.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024c1');
  perform pg_temp.refused(format('select public.api_key_github_apps_list(%L)', pg_temp.ws('northwind-apps')), '42501');
  if public.api_key_github_apps_list(pg_temp.ws('southwind-apps')) <> '[]'::jsonb then
    raise exception 'FAIL: Southwind lists Northwind''s Apps';
  end if;

  -- Not even an owner selects the tables: the rows are reached through the functions.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
  perform pg_temp.refused('select 1 from public.api_key_github_apps', '42501');
  perform pg_temp.refused('select key_id from public.api_key_github_apps', '42501');
  perform pg_temp.refused('select 1 from public.runner_job_needs_app', '42501');
  perform pg_temp.refused('update public.api_key_github_apps set last_token_at = now()', '42501');
  perform pg_temp.refused('delete from public.api_key_github_apps', '42501');
  perform pg_temp.refused(format('insert into public.api_key_github_apps (key_id, workspace_id, app_id, slug, bot_id, ciphertext, iv) values (%L, %L, 1, ''x'', 1, ''c'', ''i'')',
    pg_temp.kid('QA dashboard'), pg_temp.ws('northwind-apps')), '42501');
end $$;
reset role;

-- ── The service role's own reads: a job's App, and the mint ──
select pg_temp.queue('digest first', 'Weekly digest', 50);
select pg_temp.queue('person first', null, 40);
select pg_temp.queue('qa first', 'QA dashboard', 30);
do $$
begin
  if not pg_temp.marked('digest first') or pg_temp.marked('person first') or pg_temp.marked('qa first') then
    raise exception 'FAIL: only the job queued while its key held an App is marked';
  end if;
end $$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
do $$
begin
  perform pg_temp.refused(format('select public.api_key_github_app_of_job(%L)', pg_temp.jid('digest first')), '42501');
  perform pg_temp.refused(format('select public.api_key_github_app_minted(%L)', pg_temp.kid('Weekly digest')), '42501');
end $$;
reset role;

set local role service_role;
do $$
declare got jsonb;
begin
  got := public.api_key_github_app_of_job(pg_temp.jid('digest first'));
  if got is null or (got->>'key_id')::uuid <> pg_temp.kid('Weekly digest') or (got->>'workspace_id')::uuid <> pg_temp.ws('northwind-apps')
     or (got->>'working')::boolean is not true or (got->>'needs_app')::boolean is not true
     or (got->'app'->>'app_id')::bigint <> 4001 or got->'app'->>'slug' <> 'northwind-bot' or (got->'app'->>'bot_id')::bigint <> 90001
     or got->'app'->>'ciphertext' <> 'sealed-for-northwind-bot' or got->'app'->>'iv' <> 'iv-for-northwind-bot' then
    raise exception 'FAIL: a job of a key with an App answered %', got;
  end if;
  -- A key with no App answers its job with no App and needs none; a person's job, and no job, answer nothing.
  got := public.api_key_github_app_of_job(pg_temp.jid('qa first'));
  if got is null or got->'app' <> 'null'::jsonb or (got->>'needs_app')::boolean is not false or (got->>'working')::boolean is not true then
    raise exception 'FAIL: a job of a key with no App answered %', got;
  end if;
  if public.api_key_github_app_of_job(pg_temp.jid('person first')) is not null or public.api_key_github_app_of_job(gen_random_uuid()) is not null
     or public.api_key_github_app_of_job(null) is not null then
    raise exception 'FAIL: a job no key queued answered an App';
  end if;

  -- The mint is recorded, for the key it names alone.
  perform public.api_key_github_app_minted(pg_temp.kid('Weekly digest'));
  perform public.api_key_github_app_minted(gen_random_uuid());
end $$;
reset role;
do $$
begin
  if (select last_token_at from public.api_key_github_apps where key_id = pg_temp.kid('Weekly digest')) is null then
    raise exception 'FAIL: the mint was not recorded';
  end if;
end $$;
set local role authenticated;
do $$
declare listed jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024b1');
  if public.api_key_github_apps_list(pg_temp.ws('northwind-apps'))::text ~* 'last' then
    raise exception 'FAIL: a member reads `last token`';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
  listed := public.api_key_github_apps_list(pg_temp.ws('northwind-apps'));
  if (listed->0->>'lastTokenAt')::timestamptz <> now() then
    raise exception 'FAIL: the owner does not read when the App last minted: %', listed;
  end if;
end $$;
reset role;

-- ── Replacing: another owner attaches another pair; `last token` starts again ──
set local role authenticated;
do $$
declare got jsonb;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a2');
  got := pg_temp.attach('Weekly digest', 4002, 'northwind-bot-two', 90002);
  if got <> jsonb_build_object('keyId', pg_temp.kid('Weekly digest'), 'slug', 'northwind-bot-two', 'lastTokenAt', null) then
    raise exception 'FAIL: replacing answered %', got;
  end if;
end $$;
reset role;
do $$
declare g public.api_key_github_apps;
begin
  select * into g from public.api_key_github_apps where key_id = pg_temp.kid('Weekly digest');
  if (select count(*) from public.api_key_github_apps) <> 1 or g.app_id <> 4002 or g.slug <> 'northwind-bot-two' or g.bot_id <> 90002
     or g.ciphertext <> 'sealed-for-northwind-bot-two' or g.iv <> 'iv-for-northwind-bot-two'
     or g.attached_by <> '00000000-0000-4000-8000-0000000024a2' or g.last_token_at is not null then
    raise exception 'FAIL: the App was not replaced as attached: %', g;
  end if;
end $$;

-- ── Which runner takes the jobs of a key with an App ──
-- Queued oldest first: a job of the key with an App, a person's, a key with none (the three above).
set local role service_role;
do $$
begin
  -- A runner that did not register githubApp skips the App's job and takes the others, oldest first.
  if pg_temp.claims('plain-box') <> pg_temp.jid('person first')::text then
    raise exception 'FAIL: the runner with no githubApp did not take the person''s job';
  end if;
  if pg_temp.claims('plain-box') <> pg_temp.jid('qa first')::text then
    raise exception 'FAIL: the runner with no githubApp did not take the job of a key with no App';
  end if;
  if pg_temp.claims('plain-box') <> 'none' then
    raise exception 'FAIL: the runner with no githubApp took a job of a key with an App';
  end if;
  -- The runner that did takes it.
  if pg_temp.claims('app-box') <> pg_temp.jid('digest first')::text then
    raise exception 'FAIL: the runner with githubApp did not take the job of a key with an App';
  end if;
end $$;
reset role;

-- ── A job queued while the key held an App stays one after Remove ──
select pg_temp.queue('digest second', 'Weekly digest', 20);
select pg_temp.queue('digest third', 'Weekly digest', 19);
set local role authenticated;
do $$
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024b1');
  perform pg_temp.refused(format('select public.api_key_github_app_remove(%L)', pg_temp.kid('Weekly digest')), '42501');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a2');
  if public.api_key_github_app_remove(pg_temp.kid('Weekly digest')) is not true then
    raise exception 'FAIL: removing an App answered no App was there';
  end if;
  -- Removing it again, or from a key with none, changes nothing.
  if public.api_key_github_app_remove(pg_temp.kid('Weekly digest')) is not false
     or public.api_key_github_app_remove(pg_temp.kid('QA dashboard')) is not false then
    raise exception 'FAIL: removing an App twice, or from a key with none, did something';
  end if;
  if public.api_key_github_apps_list(pg_temp.ws('northwind-apps')) <> '[]'::jsonb then
    raise exception 'FAIL: a removed App is still listed';
  end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.api_key_github_apps where key_id = pg_temp.kid('Weekly digest')) then
    raise exception 'FAIL: Remove left the sealed key';
  end if;
  if not pg_temp.marked('digest second') or not pg_temp.marked('digest third') then
    raise exception 'FAIL: Remove unmarked the jobs queued for the App';
  end if;
end $$;
select pg_temp.queue('digest after remove', 'Weekly digest', 10);
set local role service_role;
do $$
declare got jsonb;
begin
  -- The runner with no githubApp still never takes them; the job queued after Remove is a job of a key with none.
  if pg_temp.claims('plain-box') <> pg_temp.jid('digest after remove')::text then
    raise exception 'FAIL: the runner with no githubApp did not take the job queued after Remove, or took one queued for the App';
  end if;
  if pg_temp.claims('plain-box') <> 'none' then
    raise exception 'FAIL: the runner with no githubApp took a job queued for a removed App';
  end if;
  -- The runner with githubApp takes it, and learns that it needs an App the key no longer holds.
  if pg_temp.claims('app-box') <> pg_temp.jid('digest second')::text then
    raise exception 'FAIL: the runner with githubApp did not take the job queued for a removed App';
  end if;
  got := public.api_key_github_app_of_job(pg_temp.jid('digest second'));
  if got->'app' <> 'null'::jsonb or (got->>'needs_app')::boolean is not true or (got->>'working')::boolean is not true then
    raise exception 'FAIL: a job queued for a removed App answered %', got;
  end if;
  got := public.api_key_github_app_of_job(pg_temp.jid('digest after remove'));
  if (got->>'needs_app')::boolean is not false then
    raise exception 'FAIL: a job queued once the key held no App needs one: %', got;
  end if;
end $$;
reset role;

-- ── An App attached after a job was queued still holds it for the runners that can run it ──
select pg_temp.queue('qa second', 'QA dashboard', 8);
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
select pg_temp.attach('QA dashboard', 4003, 'qa-bot', 90003);
reset role;
set local role service_role;
do $$
begin
  if pg_temp.marked('qa second') then
    raise exception 'FAIL: a job queued before the App was attached is marked';
  end if;
  if pg_temp.claims('plain-box') <> 'none' then
    raise exception 'FAIL: the runner with no githubApp took the job of a key that holds an App now';
  end if;
end $$;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
select public.api_key_github_app_remove(pg_temp.kid('QA dashboard'));
reset role;
set local role service_role;
do $$
begin
  -- Not marked, and its key holds no App again: any runner may take it, as before this PRD.
  if pg_temp.claims('plain-box') <> pg_temp.jid('qa second')::text then
    raise exception 'FAIL: the runner with no githubApp did not take the job of a key whose App was removed, queued before it was attached';
  end if;
end $$;
reset role;

-- ── Revoking the key deletes its sealed key, by either function that revokes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
select pg_temp.attach('Third key', 4004, 'third-bot', 90004);
select pg_temp.attach('Fourth key', 4005, 'fourth-bot', 90005);
select pg_temp.attach('Fifth key', 4006, 'fifth-bot', 90006);
reset role;
select pg_temp.queue('third queued', 'Third key', 5);
select pg_temp.queue('fourth queued', 'Fourth key', 4);
set local role authenticated;
do $$
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
  if jsonb_array_length(public.api_key_github_apps_list(pg_temp.ws('northwind-apps'))) <> 3 then
    raise exception 'FAIL: the three Apps are not listed';
  end if;
  -- Revoked by its API key function.
  perform public.api_key_revoke(pg_temp.ws('northwind-apps'), pg_temp.kid('Third key'));
  -- Revoked as any token of its workspace is, which no API key function does.
  perform public.agent_token_revoke(pg_temp.ws('northwind-apps'), pg_temp.kid('Fourth key'));
  if public.api_key_github_apps_list(pg_temp.ws('northwind-apps'))->0->>'slug' <> 'fifth-bot'
     or jsonb_array_length(public.api_key_github_apps_list(pg_temp.ws('northwind-apps'))) <> 1 then
    raise exception 'FAIL: a revoked key''s App is still listed';
  end if;
  -- A revoked key takes no App, and a replaced pair never revives it.
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Third key')), '42501');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Fourth key')), '42501');
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.api_key_github_apps where key_id in (pg_temp.kid('Third key'), pg_temp.kid('Fourth key'))) then
    raise exception 'FAIL: revoking a key left its sealed private key';
  end if;
  if not exists (select 1 from public.api_key_github_apps where key_id = pg_temp.kid('Fifth key')) then
    raise exception 'FAIL: revoking a key deleted another key''s App';
  end if;
end $$;
set local role service_role;
do $$
declare got jsonb;
begin
  -- The job queued for a revoked key's App stays one: the key no longer works and the App is gone, so Galaxy
  -- ends it failed. No runner without githubApp takes it.
  got := public.api_key_github_app_of_job(pg_temp.jid('third queued'));
  if got->'app' <> 'null'::jsonb or (got->>'needs_app')::boolean is not true or (got->>'working')::boolean is not false then
    raise exception 'FAIL: a job of a revoked key answered %', got;
  end if;
  if pg_temp.claims('plain-box') <> 'none' then
    raise exception 'FAIL: the runner with no githubApp took the job of a revoked key''s App';
  end if;
end $$;
reset role;

-- ── A key whose maker left keeps its row and stops working ──
select pg_temp.queue('fifth queued', 'Fifth key', 2);
delete from public.workspace_members
 where workspace_id = pg_temp.ws('northwind-apps') and user_id = '00000000-0000-4000-8000-0000000024a1';
set local role service_role;
do $$
declare got jsonb;
begin
  got := public.api_key_github_app_of_job(pg_temp.jid('fifth queued'));
  if (got->>'working')::boolean is not false or got->'app'->>'slug' <> 'fifth-bot' or (got->>'needs_app')::boolean is not true then
    raise exception 'FAIL: a job of a key whose maker left answered %', got;
  end if;
end $$;
reset role;
set local role authenticated;
do $$
begin
  -- Ada, who left, may no more; Cleo, who owns Northwind, removes the App of the key Ada left behind.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1');
  perform pg_temp.refused(format('select public.api_key_github_app_remove(%L)', pg_temp.kid('Fifth key')), '42501');
  perform pg_temp.refused(format('select public.api_key_github_apps_list(%L)', pg_temp.ws('northwind-apps')), '42501');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a2');
  if jsonb_array_length(public.api_key_github_apps_list(pg_temp.ws('northwind-apps'))) <> 1 then
    raise exception 'FAIL: the App of a key whose maker left is not listed';
  end if;
  if public.api_key_github_app_remove(pg_temp.kid('Fifth key')) is not true then
    raise exception 'FAIL: an owner did not remove the App of a key whose maker left';
  end if;
end $$;
reset role;

-- ── Southwind's owner attaches to Southwind's key, and Northwind's people read none of it ──
set local role authenticated;
do $$
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024c1');
  perform pg_temp.attach('Southwind tool', 4010, 'southwind-bot', 90010);
  if public.api_key_github_apps_list(pg_temp.ws('southwind-apps'))->0->>'slug' <> 'southwind-bot' then
    raise exception 'FAIL: Dan did not read Southwind''s App';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000024a2');
  perform pg_temp.refused(format('select public.api_key_github_apps_list(%L)', pg_temp.ws('southwind-apps')), '42501');
  perform pg_temp.refused(format('select public.api_key_github_app_remove(%L)', pg_temp.kid('Southwind tool')), '42501');
  perform pg_temp.refused(format('select public.api_key_github_app_attach(%L, 1, ''app'', 2, ''c'', ''i'')', pg_temp.kid('Southwind tool')), '42501');
  if public.api_key_github_apps_list(pg_temp.ws('northwind-apps')) <> '[]'::jsonb then
    raise exception 'FAIL: Northwind lists Southwind''s App';
  end if;
end $$;
reset role;

select 'api_key_github_apps: every check passed' as result;

rollback;
