-- Who may read and change a product's Pitch settings, what the kit reads of them, and who may touch a
-- product's pitch assets (PRD 1108 s1). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/pitch_settings.sql
-- A PRD 859 look reads as its preset: pitch_from_look() is the value the migration wrote for every
-- existing product, and every product's stored preset agrees with its pitch_look. Whoever may edit
-- Settings › Business (any member of the workspace) changes one product's settings through
-- set_pitch_settings(), its other products keep theirs, and pitch_look follows the preset it names;
-- set_pitch_look() resets the look to its preset and keeps the rest. A value the kit could never parse
-- is refused (22023), a product of another workspace is P0002, a member of another workspace, an account
-- in no workspace and anyone signed out are refused (42501), and nothing changes. Nobody signed in
-- writes products.pitch directly. pitch_settings_for_repo() answers the stored value of the repository's
-- product, `{}` for a repository with no product, and refuses a stranger (42501). A member uploads,
-- replaces, reads and removes their own products' files in the private pitch-assets bucket; nobody else
-- reads or writes them. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- Storage refuses a delete outside its API unless this is set; the policies still decide whose delete
-- touches a row, which is what this check proves.
do $$ begin perform set_config('storage.allow_delete_query', 'true', true); end $$;

-- ── The cast ──
-- Olga owns Vertuoza and Mo is a member of it (github_org vertuoza); Carl owns Acme; Sam belongs to
-- no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000001108a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000001108b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000001108c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000001108d1', 'sam@nowhere.test', now())
on conflict (id) do nothing;
insert into public.workspaces (slug, name, github_org) values ('acme-pitch', 'Acme', 'acme-pitch');
update public.workspaces set github_org = 'vertuoza' where slug = 'vertuoza' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000001108a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000001108b1'::uuid, 'member'),
         ('acme-pitch', '00000000-0000-4000-8000-0000001108c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-pitch');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
create temporary table made (name text primary key, id uuid);
grant select, insert, update on made to anon, authenticated, service_role;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;
-- Runs a call that must be refused as out of shape (22023).
create function pg_temp.out_of_shape(stmt text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % was taken: %', stmt, why;
exception when invalid_parameter_value then null;
end;
$$;
-- Every product's settings and look, as one value to compare before and after a refusal.
-- Puts a repository in one product, and in that product only: what repository_set_product() did before
-- PRD 1364 dropped it, written here as the links it leaves.
create function pg_temp.move_to(repo text, product uuid) returns void language sql security definer as $$
  delete from public.product_repositories l
   where l.repository = repo and l.workspace_id = (select p.workspace_id from public.products p where p.id = product);
  insert into public.product_repositories (product_id, workspace_id, repository, added_by)
  select p.id, p.workspace_id, repo, 'person' from public.products p where p.id = product;
$$;
create function pg_temp.settings() returns text language sql security definer as $$
  select coalesce(string_agg(p.id::text || ':' || p.pitch_look || ':' || p.pitch::text, ';' order by p.id), '') from public.products p;
$$;
-- A pitch asset's path for one of the made products.
create function pg_temp.asset(product text, file text) returns text language sql security definer as $$
  select (select p.workspace_id from public.products p where p.id = pg_temp.made(product))::text || '/' || pg_temp.made(product)::text || '/' || file;
$$;
-- How many pitch assets the caller sees.
create function pg_temp.assets_seen() returns bigint language sql as $$
  select count(*) from storage.objects o where o.bucket_id = 'pitch-assets';
$$;

-- ── The migration: a PRD 859 look reads as its preset, and every product's preset agrees ──
do $$
begin
  if public.pitch_from_look('keynote') <> '{"look": {"preset": "keynote"}}'::jsonb
     or public.pitch_from_look('arcade') <> '{"look": {"preset": "arcade"}}'::jsonb then
    raise exception 'FAIL: pitch_from_look answered % and %', public.pitch_from_look('keynote'), public.pitch_from_look('arcade');
  end if;
  if exists (select 1 from public.products p where coalesce(p.pitch #>> '{look,preset}', 'arcade') <> p.pitch_look) then
    raise exception 'FAIL: a product''s stored preset disagrees with its pitch_look';
  end if;
  if not exists (select 1 from storage.buckets b where b.id = 'pitch-assets' and not b.public) then
    raise exception 'FAIL: no private pitch-assets bucket';
  end if;
end $$;

-- ── Mo, a member, opens the business and adds a second product: both read as the default ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000001108b1');
do $$
declare
  b public.businesses;
  second public.products;
begin
  b := public.business_open(pg_temp.ws('vertuoza'));
  insert into made select 'first', p.id from public.products p where p.business_id = b.id order by p.ordinal limit 1;
  second := public.product_add(pg_temp.ws('vertuoza'), 'Second product');
  insert into made values ('second', second.id);
  if second.pitch <> '{}'::jsonb or second.pitch_look <> 'arcade' then
    raise exception 'FAIL: a new product starts with % in %', second.pitch, second.pitch_look;
  end if;
  perform pg_temp.move_to('vertuoza/vertuo-apps', pg_temp.made('first'));
end $$;

-- ── Mo saves the second product's settings; the first keeps its own, and pitch_look follows ──
do $$
declare
  saved jsonb := '{"look": {"preset": "keynote", "colors": {"accent": "#3D5AFE"}}, "voice": {"preset": "formal", "instructions": "Say worksite."}, "length": {"min": 20, "max": 40}}';
  changed public.products;
begin
  changed := public.set_pitch_settings(pg_temp.ws('vertuoza'), pg_temp.made('second'), saved);
  if changed.pitch <> saved or changed.pitch_look <> 'keynote' or changed.id <> pg_temp.made('second') then
    raise exception 'FAIL: set_pitch_settings answered %', changed;
  end if;
  if (select p.pitch from public.products p where p.id = pg_temp.made('second')) <> saved then
    raise exception 'FAIL: the second product''s settings did not hold';
  end if;
  if (select p.pitch_look from public.products p where p.id = pg_temp.made('first')) <> 'arcade' then
    raise exception 'FAIL: changing one product''s settings changed another''s';
  end if;
  -- Settings naming no preset keep the product's pitch_look.
  changed := public.set_pitch_settings(pg_temp.ws('vertuoza'), pg_temp.made('second'), '{"music": {"provider": "freepd", "mood": "upbeat"}}');
  if changed.pitch_look <> 'keynote' then
    raise exception 'FAIL: settings with no preset changed pitch_look to %', changed.pitch_look;
  end if;
  changed := public.set_pitch_settings(pg_temp.ws('vertuoza'), pg_temp.made('second'), saved);
  -- PRD 859's dropdown resets the look to its preset and keeps the rest.
  changed := public.set_pitch_look(pg_temp.ws('vertuoza'), pg_temp.made('second'), 'arcade');
  if changed.pitch_look <> 'arcade' or changed.pitch -> 'look' <> '{"preset": "arcade"}'::jsonb
     or changed.pitch -> 'voice' <> saved -> 'voice' then
    raise exception 'FAIL: set_pitch_look left %', changed.pitch;
  end if;
  changed := public.set_pitch_settings(pg_temp.ws('vertuoza'), pg_temp.made('second'), saved);
end $$;

-- ── The kit's read: the stored value of the repository's product, {} for one with no product ──
do $$
begin
  if public.pitch_settings_for_repo('vertuoza/vertuo-apps') <> (select p.pitch from public.products p where p.id = pg_temp.made('first')) then
    raise exception 'FAIL: pitch_settings_for_repo did not read the first product''s settings';
  end if;
  if public.pitch_settings_for_repo('vertuoza/not-listed') <> '{}'::jsonb then
    raise exception 'FAIL: a repository with no product did not read {}';
  end if;
  perform pg_temp.move_to('vertuoza/vertuo-apps', pg_temp.made('second'));
  if public.pitch_settings_for_repo('VERTUOZA/vertuo-apps') #>> '{look,preset}' <> 'keynote' then
    raise exception 'FAIL: pitch_settings_for_repo did not read the second product''s settings';
  end if;
end $$;

-- ── A pitch asset: Mo uploads, replaces, reads and removes one of his products' files ──
do $$
begin
  insert into storage.objects (bucket_id, name) values ('pitch-assets', pg_temp.asset('second', 'logo.svg'));
  insert into storage.objects (bucket_id, name) values ('pitch-assets', pg_temp.asset('second', 'brand.woff2'));
  update storage.objects set name = pg_temp.asset('second', 'logo-2.svg')
   where bucket_id = 'pitch-assets' and name = pg_temp.asset('second', 'logo.svg');
  if pg_temp.assets_seen() <> 2 then raise exception 'FAIL: Mo sees % pitch assets', pg_temp.assets_seen(); end if;
  delete from storage.objects where bucket_id = 'pitch-assets' and name = pg_temp.asset('second', 'brand.woff2');
  if pg_temp.assets_seen() <> 1 then raise exception 'FAIL: Mo could not remove a pitch asset'; end if;
  -- A path that names no product of the workspace, or the wrong shape, takes nothing.
  perform pg_temp.forbidden(format('insert into storage.objects (bucket_id, name) values (''pitch-assets'', %L)',
    pg_temp.ws('vertuoza')::text || '/' || gen_random_uuid()::text || '/logo.svg'), 'a product the workspace does not hold');
  perform pg_temp.forbidden(format('insert into storage.objects (bucket_id, name) values (''pitch-assets'', %L)',
    pg_temp.made('second')::text || '/logo.svg'), 'a path with no workspace');
end $$;

-- ── A value the kit could never parse, and a product of another workspace, are refused ──
reset role;
create temporary table before_refusals as select pg_temp.settings() as s;
grant select on before_refusals to anon, authenticated;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000001108b1');
do $$
declare
  bad jsonb;
  stmt text;
begin
  foreach bad in array array[
    '[]'::jsonb, '"keynote"'::jsonb, 'null'::jsonb,
    '{"look": {"preset": "neon"}}', '{"look": {"preset": 3}}',
    jsonb_build_object('voice', jsonb_build_object('instructions', repeat('x', 601))),
    '{"voice": {"instructions": 12}}',
    '{"length": {"min": 10}}', '{"length": {"max": 61}}', '{"length": {"min": "20"}}',
    jsonb_build_object('blob', repeat('x', 17000))
  ] loop
    perform pg_temp.out_of_shape(format('select public.set_pitch_settings(%L, %L, %L)', pg_temp.ws('vertuoza'), pg_temp.made('first'), bad), bad::text);
  end loop;
  perform pg_temp.out_of_shape(format('select public.set_pitch_settings(%L, %L, null)', pg_temp.ws('vertuoza'), pg_temp.made('first')), 'null');
  -- 600 characters of instructions are taken (then put back as they were).
  perform public.set_pitch_settings(pg_temp.ws('vertuoza'), pg_temp.made('first'), jsonb_build_object('voice', jsonb_build_object('instructions', repeat('x', 600))));
  perform public.set_pitch_settings(pg_temp.ws('vertuoza'), pg_temp.made('first'), '{}');
  begin
    perform public.set_pitch_settings(pg_temp.ws('vertuoza'), gen_random_uuid(), '{}');
    raise exception 'FAIL: set_pitch_settings took a product the workspace does not hold';
  exception when no_data_found then null; end;
  -- Nobody signed in writes the column directly.
  perform pg_temp.forbidden(format('update public.products set pitch = ''{}'' where id = %L', pg_temp.made('second')), 'a member, directly');
end $$;

-- ── Outsiders: a member of another workspace and a stranger are refused, and see no asset ──
do $$
declare who text;
begin
  foreach who in array array['00000000-0000-4000-8000-0000001108c1', '00000000-0000-4000-8000-0000001108d1'] loop
    perform pg_temp.sign_in(who);
    perform pg_temp.forbidden(format('select public.set_pitch_settings(%L, %L, ''{}'')', pg_temp.ws('vertuoza'), pg_temp.made('second')), who);
    perform pg_temp.forbidden('select public.pitch_settings_for_repo(''vertuoza/vertuo-apps'')', who);
    if pg_temp.assets_seen() <> 0 then raise exception 'FAIL: % reads a pitch asset', who; end if;
    perform pg_temp.forbidden(format('insert into storage.objects (bucket_id, name) values (''pitch-assets'', %L)', pg_temp.asset('second', 'mine.svg')), who);
    update storage.objects set name = pg_temp.asset('second', 'stolen.svg') where bucket_id = 'pitch-assets';
    delete from storage.objects where bucket_id = 'pitch-assets';
  end loop;
  -- Carl names his own workspace with Vertuoza's product: still nothing to change.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000001108c1');
  begin
    perform public.set_pitch_settings(pg_temp.ws('acme-pitch'), pg_temp.made('second'), '{}');
    raise exception 'FAIL: set_pitch_settings changed another workspace''s product';
  exception when no_data_found then null; end;
end $$;
reset role;

-- ── Signed out: neither function runs, and no asset is seen ──
set local role anon;
do $$
begin
  perform pg_temp.forbidden(format('select public.set_pitch_settings(%L, %L, ''{}'')', pg_temp.ws('vertuoza'), pg_temp.made('second')), 'anon');
  perform pg_temp.forbidden('select public.pitch_settings_for_repo(''vertuoza/vertuo-apps'')', 'anon');
  if (select count(*) from storage.objects o where o.bucket_id = 'pitch-assets') <> 0 then
    raise exception 'FAIL: anon reads a pitch asset';
  end if;
end $$;
reset role;

do $$
begin
  if pg_temp.settings() <> (select s from before_refusals) then
    raise exception 'FAIL: a refused call changed a product''s settings';
  end if;
  if (select count(*) from storage.objects o where o.bucket_id = 'pitch-assets') <> 1
     or not exists (select 1 from storage.objects o where o.bucket_id = 'pitch-assets' and o.name = pg_temp.asset('second', 'logo-2.svg')) then
    raise exception 'FAIL: an outsider changed a pitch asset';
  end if;
end $$;

rollback;

\echo 'pitch_settings: every check passed'
