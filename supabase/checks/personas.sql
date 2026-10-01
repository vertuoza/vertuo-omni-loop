-- Who may read and write a product's personas, and what agents read of them (PRD 799). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations and the
-- demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/personas.sql
-- Any member of a workspace adds, edits, deletes and restores its products' personas through the
-- functions of 20261022090000_personas.sql; a member of another workspace and anyone signed out are
-- refused (42501), a bad stance, name, text, trade or avatar is refused (22023, the field in `hint`),
-- and a persona that is gone is P0002. The service role adds, as the import does, through the same
-- checks. A persona follows its product: a repository reads its own product's personas, and a product
-- that goes takes its personas with it. business_for_repo() returns the product's personas oldest first,
-- `[]` without, and its `state` still comes from claims only. Nothing is seeded, and nobody writes the
-- table directly.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── Nothing seeded ──
do $$
begin
  if exists (select 1 from public.personas) then
    raise exception 'FAIL: a persona exists before anyone added one';
  end if;
end $$;

-- ── The cast ──
-- Olga and Mo are members of Vertuoza (github_org vertuoza); Carl owns Acme; Sam belongs to no
-- workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000079a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000079b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000079c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000079d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-personas', 'Acme', 'acme-personas');
update public.workspaces set github_org = 'vertuoza' where slug = 'vertuoza' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000079a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000000079b1'::uuid, 'member'),
         ('acme-personas', '00000000-0000-4000-8000-0000000079c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-personas');
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
-- Runs a call that must be refused as invalid, naming `field` in its hint.
create function pg_temp.invalid(stmt text, field text) returns void language plpgsql as $$
declare got text;
begin
  execute stmt;
  raise exception 'FAIL: % was taken', stmt;
exception when invalid_parameter_value then
  get stacked diagnostics got = pg_exception_hint;
  if got is distinct from field then
    raise exception 'FAIL: % was refused naming %, not %', stmt, got, field;
  end if;
end;
$$;
-- A valid avatar.
create function pg_temp.face(skin int default 0) returns jsonb language sql as $$
  select jsonb_build_object('v', 1, 'skin', skin, 'hair', 2, 'hairColor', 1, 'outfit', 3, 'accessory', 0);
$$;
-- Every persona, as one value to compare before and after a refusal.
create function pg_temp.cast_now() returns text language sql security definer as $$
  select coalesce(string_agg(row(p.*)::text, ';' order by p.id), '') from public.personas p;
$$;

-- ── The business and two products, opened by Mo ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000079b1');
do $$
declare first uuid;
begin
  perform public.business_open(pg_temp.ws('vertuoza'));
  select p.id into first from public.products p where p.workspace_id = pg_temp.ws('vertuoza') order by p.ordinal limit 1;
  insert into made values ('erp', first);
  insert into made values ('loop', (public.product_add(pg_temp.ws('vertuoza'), 'The Loop')).id);
  perform public.repository_set_product(pg_temp.ws('vertuoza'), 'vertuoza/vertuo-omni-loop', pg_temp.made('loop'));
  -- A confirmed claim on the second product only: vertuo-apps (on the first) reads state none.
  perform public.claim_pick(pg_temp.ws('vertuoza'), pg_temp.made('loop'), 'offering', 'Omni Loop', 'pick');
end $$;

-- ── Before any persona: [] ──
do $$
declare got jsonb;
begin
  got := public.business_for_repo('vertuoza/vertuo-apps');
  if got->'personas' is distinct from '[]'::jsonb or got->>'state' <> 'none' then
    raise exception 'FAIL: business_for_repo with no persona answered %', got;
  end if;
end $$;

-- ── Mo adds, edits, deletes and restores ──
do $$
declare
  p public.personas;
begin
  p := public.persona_add(pg_temp.ws('vertuoza'), pg_temp.made('erp'), ' Marc ', 'skeptical', 'plumber', pg_temp.face(),
                          'Runs a company of five plumbers', 'Mostly the quotes');
  if p.name <> 'Marc' or p.stance <> 'skeptical' or p.trade <> 'plumber' or p.avatar <> pg_temp.face()
     or p.who <> 'Runs a company of five plumbers' or p.usage <> 'Mostly the quotes' or p.product_id <> pg_temp.made('erp')
     or p.workspace_id <> pg_temp.ws('vertuoza') or p.created_by <> '00000000-0000-4000-8000-0000000079b1'::uuid then
    raise exception 'FAIL: persona_add did not store Marc as given: %', p;
  end if;
  insert into made values ('marc', p.id);
  p := public.persona_add(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'Lea', 'excited', 'office', pg_temp.face(5), '', '');
  insert into made values ('lea', p.id);
  p := public.persona_add(pg_temp.ws('vertuoza'), pg_temp.made('loop'), 'Ines', 'neutral', 'developer', pg_temp.face(2),
                          'Builds the loop', 'Everything');
  insert into made values ('ines', p.id);

  p := public.persona_edit(pg_temp.ws('vertuoza'), pg_temp.made('lea'), 'Léa', 'neutral', 'accountant', pg_temp.face(4),
                           'Closes the month', 'The export');
  if p.name <> 'Léa' or p.stance <> 'neutral' or p.trade <> 'accountant' or p.avatar <> pg_temp.face(4)
     or p.who <> 'Closes the month' or p.usage <> 'The export' or p.product_id <> pg_temp.made('erp') then
    raise exception 'FAIL: persona_edit did not change Lea: %', p;
  end if;

  p := public.persona_delete(pg_temp.ws('vertuoza'), pg_temp.made('marc'));
  if exists (select 1 from public.personas x where x.id = pg_temp.made('marc')) then
    raise exception 'FAIL: a deleted persona is still read';
  end if;
  if (public.business_for_repo('vertuoza/vertuo-apps'))::text like '%Marc%' then
    raise exception 'FAIL: agents read a deleted persona';
  end if;
  begin
    perform public.persona_delete(pg_temp.ws('vertuoza'), pg_temp.made('marc'));
    raise exception 'FAIL: a persona was deleted twice';
  exception when no_data_found then null; end;
  begin
    perform public.persona_edit(pg_temp.ws('vertuoza'), pg_temp.made('marc'), 'Marc', 'neutral', 'plumber', pg_temp.face(), '', '');
    raise exception 'FAIL: a deleted persona was edited';
  exception when no_data_found then null; end;

  p := public.persona_restore(pg_temp.ws('vertuoza'), pg_temp.made('marc'));
  if p.name <> 'Marc' or not exists (select 1 from public.personas x where x.id = pg_temp.made('marc')) then
    raise exception 'FAIL: Undo did not bring Marc back: %', p;
  end if;
  begin
    perform public.persona_restore(pg_temp.ws('vertuoza'), pg_temp.made('marc'));
    raise exception 'FAIL: a persona that is not deleted was restored';
  exception when no_data_found then null; end;
  begin
    perform public.persona_edit(pg_temp.ws('vertuoza'), gen_random_uuid(), 'Nobody', 'neutral', 'plumber', pg_temp.face(), '', '');
    raise exception 'FAIL: persona_edit took an id that is not a persona';
  exception when no_data_found then null; end;
  begin
    perform public.persona_add(pg_temp.ws('vertuoza'), gen_random_uuid(), 'Nobody', 'neutral', 'plumber', pg_temp.face(), '', '');
    raise exception 'FAIL: persona_add took a product that is not the workspace''s';
  exception when no_data_found then null; end;
end $$;

-- ── Bad values: 22023 naming the field, nothing stored ──
do $$
declare
  ws uuid := pg_temp.ws('vertuoza');
  erp uuid := pg_temp.made('erp');
  lea uuid := pg_temp.made('lea');
  face jsonb := pg_temp.face();
  bad record;
begin
  create temporary table before_bad as select pg_temp.cast_now() s;
  for bad in select * from (values
    ('name',    format('select public.persona_add(%L, %L, ''   '', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face)),
    ('name',    format('select public.persona_add(%L, %L, %L, ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, repeat('x', 41), face)),
    ('name',    format('select public.persona_add(%L, %L, %L, ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, E'two\nlines', face)),
    ('stance',  format('select public.persona_add(%L, %L, ''Bob'', ''angry'', ''plumber'', %L, '''', '''')', ws, erp, face)),
    ('stance',  format('select public.persona_add(%L, %L, ''Bob'', null, ''plumber'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''Plumber'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber and roofer'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''site-foreman'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', %L, %L, '''', '''')', ws, erp, repeat('x', 41), face)),
    ('who',     format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, %L, '''')', ws, erp, face, repeat('x', 401))),
    ('usage',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', %L)', ws, erp, face, repeat('x', 401))),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', null, '''', '''')', ws, erp)),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"skin": 6}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"hair": -1}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"hairColor": 4}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"outfit": 4}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"accessory": 4}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"v": 2}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"skin": 1.5}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"skin": "1"}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face || '{"extra": 1}')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, erp, face - 'outfit')),
    ('avatar',  format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''plumber'', ''[1]'', '''', '''')', ws, erp)),
    ('product', format('select public.persona_add(%L, null, ''Bob'', ''neutral'', ''plumber'', %L, '''', '''')', ws, face)),
    ('stance',  format('select public.persona_edit(%L, %L, ''Léa'', ''happy'', ''accountant'', %L, '''', '''')', ws, lea, face)),
    ('who',     format('select public.persona_edit(%L, %L, ''Léa'', ''neutral'', ''accountant'', %L, %L, '''')', ws, lea, face, repeat('x', 401))),
    ('avatar',  format('select public.persona_edit(%L, %L, ''Léa'', ''neutral'', ''accountant'', %L, '''', '''')', ws, lea, face || '{"skin": 9}'))
  ) as t (field, stmt) loop
    perform pg_temp.invalid(bad.stmt, bad.field);
  end loop;
  -- The edges are taken: 40 characters of name, 400 of each text, every range's last value.
  perform public.persona_add(ws, erp, repeat('n', 40), 'excited', 'heating',
    '{"v": 1, "skin": 5, "hair": 5, "hairColor": 3, "outfit": 3, "accessory": 3}'::jsonb, repeat('w', 400), repeat('u', 400));
  if not public.valid_persona_avatar('{"v": 1, "skin": 0, "hair": 0, "hairColor": 0, "outfit": 0, "accessory": 0}'::jsonb)
     or public.valid_persona_avatar('{"v": 1, "skin": 6, "hair": 0, "hairColor": 0, "outfit": 0, "accessory": 0}'::jsonb)
     or public.valid_persona_avatar(null) then
    raise exception 'FAIL: valid_persona_avatar does not hold the ranges';
  end if;
end $$;
reset role;

-- The edge persona goes, so the reads below list the cast only.
delete from public.personas where name = repeat('n', 40);
do $$
begin
  if pg_temp.cast_now() <> (select s from before_bad) then
    raise exception 'FAIL: a refused call changed the personas';
  end if;
end $$;

-- ── What agents read: the product's personas, oldest first; state from claims only ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000079a1');
do $$
declare got jsonb;
begin
  got := public.business_for_repo('vertuoza/vertuo-apps');
  if got->>'state' <> 'none' then
    raise exception 'FAIL: personas changed state: %', got;
  end if;
  if got->'personas' <> '[
        {"name": "Marc", "stance": "skeptical", "trade": "plumber", "who": "Runs a company of five plumbers", "usage": "Mostly the quotes"},
        {"name": "Léa", "stance": "neutral", "trade": "accountant", "who": "Closes the month", "usage": "The export"}
      ]'::jsonb then
    raise exception 'FAIL: vertuo-apps does not read its product''s personas oldest first: %', got->'personas';
  end if;
  got := public.business_for_repo('vertuoza/vertuo-omni-loop');
  if got->>'state' <> 'ok' or (select string_agg(x->>'name', ',') from jsonb_array_elements(got->'personas') x) <> 'Ines' then
    raise exception 'FAIL: vertuo-omni-loop does not read its own product''s personas: %', got;
  end if;
end $$;
reset role;

-- A repository with no product reads no persona.
update public.repositories set product_id = null
 where workspace_id = pg_temp.ws('vertuoza') and full_name = 'vertuoza/pdf-builder';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000079a1');
do $$
declare got jsonb;
begin
  got := public.business_for_repo('vertuoza/pdf-builder');
  if got->'personas' is distinct from '[]'::jsonb then
    raise exception 'FAIL: a repository with no product read personas: %', got;
  end if;
end $$;
reset role;

-- ── A persona follows its product: the product goes, its personas go ──
do $$
begin
  delete from public.products where id = pg_temp.made('loop');
  if exists (select 1 from public.personas where product_id = pg_temp.made('loop')) then
    raise exception 'FAIL: a product''s personas outlived it';
  end if;
  if not exists (select 1 from public.personas where id = pg_temp.made('marc')) then
    raise exception 'FAIL: removing one product took another''s personas';
  end if;
end $$;

-- ── The service role adds, as the import does, through the same checks ──
set local role service_role;
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
do $$
declare p public.personas;
begin
  p := public.persona_add(pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'Imported', 'neutral', 'driver', pg_temp.face(), '', '');
  if p.created_by is not null then raise exception 'FAIL: an imported persona names a person: %', p; end if;
  perform pg_temp.invalid(format('select public.persona_add(%L, %L, ''Bad'', ''angry'', ''driver'', %L, '''', '''')',
                                 pg_temp.ws('vertuoza'), pg_temp.made('erp'), pg_temp.face()), 'stance');
  begin
    insert into public.personas (workspace_id, product_id, name, stance, trade, avatar)
    values (pg_temp.ws('vertuoza'), pg_temp.made('erp'), 'Direct', 'neutral', 'driver', pg_temp.face());
    raise exception 'FAIL: the service role wrote public.personas directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Outsiders: refused, nothing read, nothing changed ──
create temporary table before_outsiders as select pg_temp.cast_now() s;
grant select on before_outsiders to anon, authenticated;
set local role anon;
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.persona_add(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('vertuoza'), pg_temp.made('erp'), pg_temp.face()),
    format('select public.persona_edit(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('vertuoza'), pg_temp.made('marc'), pg_temp.face()),
    format('select public.persona_delete(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.made('marc')),
    format('select public.persona_restore(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.made('marc'))
  ] loop perform pg_temp.forbidden(c, 'anon'); end loop;
  begin perform 1 from public.personas; raise exception 'FAIL: anon read public.personas';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
do $$
declare
  who text;
  c text;
begin
  foreach who in array array['00000000-0000-4000-8000-0000000079c1', '00000000-0000-4000-8000-0000000079d1'] loop
    perform pg_temp.sign_in(who);
    foreach c in array array[
      format('select public.persona_add(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('vertuoza'), pg_temp.made('erp'), pg_temp.face()),
      format('select public.persona_edit(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('vertuoza'), pg_temp.made('marc'), pg_temp.face()),
      format('select public.persona_delete(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.made('marc')),
      format('select public.persona_restore(%L, %L)', pg_temp.ws('vertuoza'), pg_temp.made('marc')),
      'select public.business_for_repo(''vertuoza/vertuo-apps'')'
    ] loop perform pg_temp.forbidden(c, who); end loop;
    if exists (select 1 from public.personas) then
      raise exception 'FAIL: % reads Vertuoza''s personas', who;
    end if;
    -- A member of Vertuoza writes nothing directly either.
  end loop;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000079b1');
  begin
    update public.personas set name = 'Hacked';
    raise exception 'FAIL: a member updated public.personas directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$
begin
  if pg_temp.cast_now() <> (select s from before_outsiders) then
    raise exception 'FAIL: a refused call changed the personas';
  end if;
end $$;

rollback;

\echo 'personas: every check passed'
