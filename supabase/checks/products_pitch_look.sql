-- Who may read and change a product's pitch look, and what the kit reads of it (PRD 859 s1). The
-- supabase workflow runs it on every pull request, after `supabase db start` has applied the
-- migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/products_pitch_look.sql
-- Every product starts in `arcade`. Whoever may edit Settings › Business (any member of the workspace)
-- changes one product's look through set_pitch_look(), and its other products keep theirs; a member
-- of another workspace, an account in no workspace and anyone signed out are refused (42501), a look
-- other than arcade or keynote is refused (22023), a product of another workspace is P0002, and
-- nothing changes. Nobody signed in writes products.pitch_look directly. pitch_look_for_repo() answers
-- the look of the repository's product, `arcade` for a repository with no product, and refuses a
-- stranger (42501). One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns Vertuoza and Mo is a member of it (github_org vertuoza); Carl owns Acme; Sam belongs to
-- no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000859a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000859b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000859c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000859d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-look', 'Acme', 'acme-look');
update public.workspaces set github_org = 'vertuoza' where slug = 'vertuoza' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000859a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000000859b1'::uuid, 'member'),
         ('acme-look', '00000000-0000-4000-8000-0000000859c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-look');
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
-- Every product's look, as one value to compare before and after a refusal.
create function pg_temp.looks() returns text language sql security definer as $$
  select coalesce(string_agg(p.id::text || ':' || p.pitch_look, ';' order by p.id), '') from public.products p;
$$;

-- ── Mo, a member, opens the business and adds a second product: both start in arcade ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000859b1');
do $$
declare
  b public.businesses;
  second public.products;
begin
  b := public.business_open(pg_temp.ws('vertuoza'));
  insert into made select 'first', p.id from public.products p where p.business_id = b.id;
  second := public.product_add(pg_temp.ws('vertuoza'), 'Second product');
  insert into made values ('second', second.id);
  if exists (select 1 from public.products p where p.workspace_id = pg_temp.ws('vertuoza') and p.pitch_look <> 'arcade') then
    raise exception 'FAIL: a product does not start in arcade';
  end if;
end $$;

-- ── The kit's read: the first product's look, arcade, for a repository pointed at it ──
do $$
begin
  if public.pitch_look_for_repo('vertuoza/vertuo-apps') <> 'arcade' then
    raise exception 'FAIL: pitch_look_for_repo did not answer arcade by default';
  end if;
  if public.pitch_look_for_repo('vertuoza/not-listed') <> 'arcade' then
    raise exception 'FAIL: a repository with no product did not read arcade';
  end if;
end $$;

-- ── Mo changes the second product's look to keynote; the first keeps arcade ──
do $$
declare
  changed public.products;
begin
  changed := public.set_pitch_look(pg_temp.ws('vertuoza'), pg_temp.made('second'), 'keynote');
  if changed.pitch_look <> 'keynote' or changed.id <> pg_temp.made('second') then
    raise exception 'FAIL: set_pitch_look answered %', changed;
  end if;
  if (select p.pitch_look from public.products p where p.id = pg_temp.made('second')) <> 'keynote' then
    raise exception 'FAIL: the second product''s look did not hold';
  end if;
  if (select p.pitch_look from public.products p where p.id = pg_temp.made('first')) <> 'arcade' then
    raise exception 'FAIL: changing one product''s look changed another''s';
  end if;
  -- A repository pointed at the second product reads keynote; one on the first still arcade.
  perform public.repository_set_product(pg_temp.ws('vertuoza'), 'vertuoza/vertuo-apps', pg_temp.made('second'));
  if public.pitch_look_for_repo('vertuoza/vertuo-apps') <> 'keynote' then
    raise exception 'FAIL: pitch_look_for_repo did not read the repository''s product''s look';
  end if;
  -- Back to arcade, as any member may.
  changed := public.set_pitch_look(pg_temp.ws('vertuoza'), pg_temp.made('second'), 'arcade');
  if changed.pitch_look <> 'arcade' then
    raise exception 'FAIL: set_pitch_look could not change the look back';
  end if;
  changed := public.set_pitch_look(pg_temp.ws('vertuoza'), pg_temp.made('second'), 'keynote');
end $$;

-- ── A look other than arcade or keynote, and a product of another workspace, are refused ──
reset role;
create temporary table before_refusals as select pg_temp.looks() as s;
grant select on before_refusals to anon, authenticated;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000859b1');
do $$
declare look text;
begin
  foreach look in array array['custom', 'Keynote', ''] loop
    begin
      perform public.set_pitch_look(pg_temp.ws('vertuoza'), pg_temp.made('first'), look);
      raise exception 'FAIL: set_pitch_look took the look %', look;
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.set_pitch_look(pg_temp.ws('vertuoza'), pg_temp.made('first'), null);
    raise exception 'FAIL: set_pitch_look took a null look';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.set_pitch_look(pg_temp.ws('vertuoza'), gen_random_uuid(), 'keynote');
    raise exception 'FAIL: set_pitch_look took a product the workspace does not hold';
  exception when no_data_found then null; end;
  -- Nobody signed in writes the column directly.
  perform pg_temp.forbidden(format('update public.products set pitch_look = ''arcade'' where id = %L', pg_temp.made('second')), 'a member, directly');
end $$;

-- ── Outsiders: a member of another workspace and a stranger are refused ──
do $$
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000859c1');
  perform pg_temp.forbidden(format('select public.set_pitch_look(%L, %L, ''arcade'')', pg_temp.ws('vertuoza'), pg_temp.made('second')), 'the owner of another workspace');
  perform pg_temp.forbidden('select public.pitch_look_for_repo(''vertuoza/vertuo-apps'')', 'the owner of another workspace');
  -- Carl names his own workspace with Vertuoza's product: still nothing to change.
  begin
    perform public.set_pitch_look(pg_temp.ws('acme-look'), pg_temp.made('second'), 'arcade');
    raise exception 'FAIL: set_pitch_look changed another workspace''s product';
  exception when no_data_found then null; end;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000859d1');
  perform pg_temp.forbidden(format('select public.set_pitch_look(%L, %L, ''arcade'')', pg_temp.ws('vertuoza'), pg_temp.made('second')), 'a stranger');
  perform pg_temp.forbidden('select public.pitch_look_for_repo(''vertuoza/vertuo-apps'')', 'a stranger');
end $$;
reset role;

-- ── Signed out: neither function runs ──
set local role anon;
do $$
begin
  perform pg_temp.forbidden(format('select public.set_pitch_look(%L, %L, ''arcade'')', pg_temp.ws('vertuoza'), pg_temp.made('second')), 'anon');
  perform pg_temp.forbidden('select public.pitch_look_for_repo(''vertuoza/vertuo-apps'')', 'anon');
end $$;
reset role;

do $$
begin
  if pg_temp.looks() <> (select s from before_refusals) then
    raise exception 'FAIL: a refused call changed a look';
  end if;
end $$;

rollback;

\echo 'products_pitch_look: every check passed'
