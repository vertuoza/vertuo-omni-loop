-- Who may read and write a product's personas, and what agents read of them (PRD 799, PRD 2779). The supabase
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
-- PRD 2779 (20270120090000_open_personas.sql): the stance is enthusiastic, neutral or skeptical, `excited`
-- taken and stored as `enthusiastic`; a trade is lower-case words with single spaces or hyphens between
-- them; the rename moved every `excited` persona; persona_find() finds one live persona by name; and every
-- change to a persona is appended to the product's knowledge history, read by the workspace's members only.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

-- ── Nothing seeded ──
do $$
begin
  if exists (select 1 from public.personas) then
    raise exception 'FAIL: a persona exists before anyone added one';
  end if;
end $$;

-- ── The cast ──
-- Olga and Mo are members of Initech (github_org initech); Carl owns Acme; Sam belongs to no
-- workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000079a1', 'olga@example.com', now()),
  ('00000000-0000-4000-8000-0000000079b1', 'mo@example.com', now()),
  ('00000000-0000-4000-8000-0000000079c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000079d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-personas', 'Acme', 'acme-personas');
update public.workspaces set github_org = 'initech' where slug = 'initech' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech', '00000000-0000-4000-8000-0000000079a1'::uuid, 'owner'),
         ('initech', '00000000-0000-4000-8000-0000000079b1'::uuid, 'member'),
         ('acme-personas', '00000000-0000-4000-8000-0000000079c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-personas');
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

-- Puts a repository in one product, and in that product only: what repository_set_product() did before
-- PRD 1364 dropped it, written here as the links it leaves.
create function pg_temp.move_to(repo text, product uuid) returns void language sql security definer as $$
  delete from public.product_repositories l
   where l.repository = repo and l.workspace_id = (select p.workspace_id from public.products p where p.id = product);
  insert into public.product_repositories (product_id, workspace_id, repository, added_by)
  select p.id, p.workspace_id, repo, 'person' from public.products p where p.id = product;
$$;
-- ── The business and two products, opened by Mo ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000079b1');
do $$
declare first uuid;
begin
  perform public.business_open(pg_temp.ws('initech'));
  select p.id into first from public.products p where p.workspace_id = pg_temp.ws('initech') order by p.ordinal limit 1;
  insert into made values ('erp', first);
  insert into made values ('loop', (public.product_add(pg_temp.ws('initech'), 'The Loop')).id);
  perform pg_temp.move_to('initech/nimbus-plan', pg_temp.made('loop'));
  -- A confirmed claim on the second product only: nimbus-apps (on the first) reads state none.
  perform public.claim_pick(pg_temp.ws('initech'), pg_temp.made('loop'), 'offering', 'Omni Loop', 'pick');
end $$;

-- ── Before any persona: [] ──
do $$
declare got jsonb;
begin
  got := public.business_for_repo('initech/nimbus-apps');
  if got->'personas' is distinct from '[]'::jsonb or got->>'state' <> 'none' then
    raise exception 'FAIL: business_for_repo with no persona answered %', got;
  end if;
end $$;

-- ── Mo adds, edits, deletes and restores ──
do $$
declare
  p public.personas;
begin
  p := public.persona_add(pg_temp.ws('initech'), pg_temp.made('erp'), ' Marc ', 'skeptical', 'plumber', pg_temp.face(),
                          'Runs a company of five plumbers', 'Mostly the quotes');
  if p.name <> 'Marc' or p.stance <> 'skeptical' or p.trade <> 'plumber' or p.avatar <> pg_temp.face()
     or p.who <> 'Runs a company of five plumbers' or p.usage <> 'Mostly the quotes' or p.product_id <> pg_temp.made('erp')
     or p.workspace_id <> pg_temp.ws('initech') or p.created_by <> '00000000-0000-4000-8000-0000000079b1'::uuid then
    raise exception 'FAIL: persona_add did not store Marc as given: %', p;
  end if;
  insert into made values ('marc', p.id);
  p := public.persona_add(pg_temp.ws('initech'), pg_temp.made('erp'), 'Lea', 'excited', 'office', pg_temp.face(5), '', '');
  insert into made values ('lea', p.id);
  p := public.persona_add(pg_temp.ws('initech'), pg_temp.made('loop'), 'Ines', 'neutral', 'developer', pg_temp.face(2),
                          'Builds the loop', 'Everything');
  insert into made values ('ines', p.id);

  p := public.persona_edit(pg_temp.ws('initech'), pg_temp.made('lea'), 'Léa', 'neutral', 'accountant', pg_temp.face(4),
                           'Closes the month', 'The export');
  if p.name <> 'Léa' or p.stance <> 'neutral' or p.trade <> 'accountant' or p.avatar <> pg_temp.face(4)
     or p.who <> 'Closes the month' or p.usage <> 'The export' or p.product_id <> pg_temp.made('erp') then
    raise exception 'FAIL: persona_edit did not change Lea: %', p;
  end if;

  p := public.persona_delete(pg_temp.ws('initech'), pg_temp.made('marc'));
  if exists (select 1 from public.personas x where x.id = pg_temp.made('marc')) then
    raise exception 'FAIL: a deleted persona is still read';
  end if;
  if (public.business_for_repo('initech/nimbus-apps'))::text like '%Marc%' then
    raise exception 'FAIL: agents read a deleted persona';
  end if;
  begin
    perform public.persona_delete(pg_temp.ws('initech'), pg_temp.made('marc'));
    raise exception 'FAIL: a persona was deleted twice';
  exception when no_data_found then null; end;
  begin
    perform public.persona_edit(pg_temp.ws('initech'), pg_temp.made('marc'), 'Marc', 'neutral', 'plumber', pg_temp.face(), '', '');
    raise exception 'FAIL: a deleted persona was edited';
  exception when no_data_found then null; end;

  p := public.persona_restore(pg_temp.ws('initech'), pg_temp.made('marc'));
  if p.name <> 'Marc' or not exists (select 1 from public.personas x where x.id = pg_temp.made('marc')) then
    raise exception 'FAIL: Undo did not bring Marc back: %', p;
  end if;
  begin
    perform public.persona_restore(pg_temp.ws('initech'), pg_temp.made('marc'));
    raise exception 'FAIL: a persona that is not deleted was restored';
  exception when no_data_found then null; end;
  begin
    perform public.persona_edit(pg_temp.ws('initech'), gen_random_uuid(), 'Nobody', 'neutral', 'plumber', pg_temp.face(), '', '');
    raise exception 'FAIL: persona_edit took an id that is not a persona';
  exception when no_data_found then null; end;
  begin
    perform public.persona_add(pg_temp.ws('initech'), gen_random_uuid(), 'Nobody', 'neutral', 'plumber', pg_temp.face(), '', '');
    raise exception 'FAIL: persona_add took a product that is not the workspace''s';
  exception when no_data_found then null; end;
end $$;

-- ── Bad values: 22023 naming the field, nothing stored ──
do $$
declare
  ws uuid := pg_temp.ws('initech');
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
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''Data'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', '' analyst'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''analyst-'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''a  b'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', ''data_analyst'', %L, '''', '''')', ws, erp, face)),
    ('trade',   format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', %L, %L, '''', '''')', ws, erp, repeat('x', 41), face)),
    ('trade',   format('select public.persona_edit(%L, %L, ''Léa'', ''neutral'', ''analyst-'', %L, '''', '''')', ws, lea, face)),
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
  got := public.business_for_repo('initech/nimbus-apps');
  if got->>'state' <> 'none' then
    raise exception 'FAIL: personas changed state: %', got;
  end if;
  if got->'personas' <> '[
        {"name": "Marc", "stance": "skeptical", "trade": "plumber", "who": "Runs a company of five plumbers", "usage": "Mostly the quotes"},
        {"name": "Léa", "stance": "neutral", "trade": "accountant", "who": "Closes the month", "usage": "The export"}
      ]'::jsonb then
    raise exception 'FAIL: nimbus-apps does not read its product''s personas oldest first: %', got->'personas';
  end if;
  got := public.business_for_repo('initech/nimbus-plan');
  if got->>'state' <> 'ok' or (select string_agg(x->>'name', ',') from jsonb_array_elements(got->'personas') x) <> 'Ines' then
    raise exception 'FAIL: nimbus-plan does not read its own product''s personas: %', got;
  end if;
end $$;
reset role;

-- A repository with no product reads no persona.
delete from public.product_repositories
 where workspace_id = pg_temp.ws('initech') and repository = 'initech/pdf-builder';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000079a1');
do $$
declare got jsonb;
begin
  got := public.business_for_repo('initech/pdf-builder');
  if got->'personas' is distinct from '[]'::jsonb then
    raise exception 'FAIL: a repository with no product read personas: %', got;
  end if;
end $$;
reset role;

-- ── PRD 2779: the stance and the trade, as the functions take them, each change recorded ──
-- The persona history's own reads, whoever is signed in.
create function pg_temp.persona_events() returns bigint language sql security definer as $$
  select count(*) from public.product_knowledge_events e where e.kind = 'persona';
$$;
create function pg_temp.last_event() returns public.product_knowledge_events language sql security definer as $$
  select * from public.product_knowledge_events e order by e.id desc limit 1;
$$;
create function pg_temp.product_name(product uuid) returns text language sql security definer as $$
  select p.name from public.products p where p.id = product;
$$;
-- The fields the history records of a persona.
create function pg_temp.fields(p public.personas) returns jsonb language sql as $$
  select jsonb_build_object('name', p.name, 'stance', p.stance, 'trade', p.trade, 'avatar', p.avatar, 'who', p.who, 'usage', p.usage);
$$;
-- The message a call is refused with under `state`; FAIL when it is taken, or refused under another state.
create function pg_temp.refusal(stmt text, state text) returns text language plpgsql as $$
declare
  got_state text;
  got text;
begin
  execute stmt;
  raise exception 'FAIL: % was taken', stmt;
exception when others then
  get stacked diagnostics got_state = returned_sqlstate, got = message_text;
  if got like 'FAIL:%' then raise; end if;
  if got_state <> state then
    raise exception 'FAIL: % was refused with % (%), not %', stmt, got_state, got, state;
  end if;
  return got;
end;
$$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000079b1');
do $$
declare
  ws uuid := pg_temp.ws('initech');
  erp uuid := pg_temp.made('erp');
  mo uuid := '00000000-0000-4000-8000-0000000079b1';
  p public.personas;
  was public.personas;
  e public.product_knowledge_events;
  before_count bigint := pg_temp.persona_events();
  got text;
  t text;
begin
  -- `excited` is taken and stored as `enthusiastic`; a trade of several words is one trade.
  p := public.persona_add(ws, erp, 'Ada', 'excited', 'data analyst', pg_temp.face(1), 'Reads the numbers', 'The exports');
  if p.stance <> 'enthusiastic' or p.trade <> 'data analyst' then
    raise exception 'FAIL: persona_add did not store Ada as enthusiastic, a data analyst: %', p;
  end if;
  e := pg_temp.last_event();
  if pg_temp.persona_events() <> before_count + 1 or e.kind <> 'persona' or e.action <> 'added' or e.persona_id <> p.id
     or e.workspace_id <> ws or e.product_id <> erp or e.before is not null or e.after <> pg_temp.fields(p)
     or e.changed_by is distinct from mo or e.legal_id is not null or e.glossary_id is not null or e.domain_id is not null then
    raise exception 'FAIL: persona_add did not append one added event, after Ada''s fields, by Mo: %', e;
  end if;

  was := p;
  p := public.persona_edit(ws, p.id, 'Ada', 'excited', 'credit-risk analyst', pg_temp.face(1), 'Reads the numbers', 'The exports');
  if p.stance <> 'enthusiastic' or p.trade <> 'credit-risk analyst' then
    raise exception 'FAIL: persona_edit did not store enthusiastic, a credit-risk analyst: %', p;
  end if;
  e := pg_temp.last_event();
  if pg_temp.persona_events() <> before_count + 2 or e.action <> 'edited' or e.persona_id <> p.id
     or e.before <> pg_temp.fields(was) or e.after <> pg_temp.fields(p) or e.changed_by is distinct from mo then
    raise exception 'FAIL: persona_edit did not append one edited event, before and after: %', e;
  end if;
  -- An edit that changes no field appends nothing.
  perform public.persona_edit(ws, p.id, 'Ada', 'enthusiastic', 'credit-risk analyst', pg_temp.face(1), 'Reads the numbers', 'The exports');
  if pg_temp.persona_events() <> before_count + 2 then
    raise exception 'FAIL: an edit that changed nothing was recorded';
  end if;

  was := p;
  p := public.persona_delete(ws, p.id);
  e := pg_temp.last_event();
  if pg_temp.persona_events() <> before_count + 3 or e.action <> 'removed' or e.persona_id <> p.id
     or e.before <> pg_temp.fields(was) or e.after is not null or e.changed_by is distinct from mo then
    raise exception 'FAIL: persona_delete did not append one removed event, before only: %', e;
  end if;
  p := public.persona_restore(ws, p.id);
  e := pg_temp.last_event();
  if pg_temp.persona_events() <> before_count + 4 or e.action <> 'restored' or e.persona_id <> p.id
     or e.before is not null or e.after <> pg_temp.fields(was) or e.changed_by is distinct from mo then
    raise exception 'FAIL: persona_restore did not append one restored event, after only: %', e;
  end if;

  -- A refused change appends nothing, and says the new words.
  got := pg_temp.refusal(format('select public.persona_add(%L, %L, ''Bob'', ''angry'', ''plumber'', %L, '''', '''')', ws, erp, pg_temp.face()), '22023');
  if got <> 'Stance: enthusiastic, neutral or skeptical.' then
    raise exception 'FAIL: persona_add refused an unknown stance with %', got;
  end if;
  got := pg_temp.refusal(format('select public.persona_edit(%L, %L, ''Ada'', ''angry'', ''plumber'', %L, '''', '''')', ws, p.id, pg_temp.face()), '22023');
  if got <> 'Stance: enthusiastic, neutral or skeptical.' then
    raise exception 'FAIL: persona_edit refused an unknown stance with %', got;
  end if;
  foreach t in array array['Data', ' analyst', 'analyst-', 'a  b', repeat('a', 41)] loop
    got := pg_temp.refusal(format('select public.persona_add(%L, %L, ''Bob'', ''neutral'', %L, %L, '''', '''')', ws, erp, t, pg_temp.face()), '22023');
    if got <> 'Trade: lower-case words with single spaces or hyphens between them, at most 40 characters, like plumber or data analyst.' then
      raise exception 'FAIL: the trade "%" was refused with %', t, got;
    end if;
  end loop;
  perform pg_temp.refusal(format('select public.persona_delete(%L, %L)', ws, gen_random_uuid()), 'P0002');
  if pg_temp.persona_events() <> before_count + 4 then
    raise exception 'FAIL: a refused change was recorded';
  end if;
  -- The longest trade is taken; then Ada goes, so the cast reads as before.
  p := public.persona_edit(ws, p.id, 'Ada', 'neutral', repeat('a', 19) || ' ' || repeat('b', 20), pg_temp.face(1), '', '');
  if char_length(p.trade) <> 40 then
    raise exception 'FAIL: a 40-character trade was refused: %', p;
  end if;
  perform public.persona_delete(ws, p.id);
end $$;

-- ── PRD 2779: persona_find(), the one live persona of a name ──
do $$
declare
  ws uuid := pg_temp.ws('initech');
  erp uuid := pg_temp.made('erp');
  twin public.personas;
  got text;
begin
  if (public.persona_find(ws, erp, 'Marc')).id <> pg_temp.made('marc')
     or (public.persona_find(ws, erp, '  Marc ')).id <> pg_temp.made('marc') then
    raise exception 'FAIL: persona_find did not find Marc';
  end if;
  got := pg_temp.refusal(format('select public.persona_find(%L, %L, ''Nobody'')', ws, erp), 'P0002');
  if got <> format('no persona named "Nobody" in %s', pg_temp.product_name(erp)) then
    raise exception 'FAIL: persona_find with none said %', got;
  end if;
  -- Ines is the other product's, not this one's.
  perform pg_temp.refusal(format('select public.persona_find(%L, %L, ''Ines'')', ws, erp), 'P0002');
  twin := public.persona_add(ws, erp, 'Marc', 'neutral', 'roofer', pg_temp.face(3), '', '');
  got := pg_temp.refusal(format('select public.persona_find(%L, %L, ''Marc'')', ws, erp), 'P0003');
  if got <> 'several personas are named "Marc": edit it on the Knowledge tab' then
    raise exception 'FAIL: persona_find with two said %', got;
  end if;
  -- A deleted persona is not found.
  perform public.persona_delete(ws, twin.id);
  if (public.persona_find(ws, erp, 'Marc')).id <> pg_temp.made('marc') then
    raise exception 'FAIL: persona_find read a deleted persona';
  end if;
  -- Mo is no member of Acme, and a product that is not the workspace's is none.
  perform pg_temp.refusal(format('select public.persona_find(%L, %L, ''Marc'')', pg_temp.ws('acme-personas'), erp), '42501');
  perform pg_temp.refusal(format('select public.persona_find(%L, %L, ''Marc'')', ws, gen_random_uuid()), 'P0002');
end $$;
reset role;

-- ── PRD 2779: the rename ──
-- Nobody stores `excited` any more, nor a trade the rule refuses, not even directly.
do $$
begin
  begin
    insert into public.personas (workspace_id, product_id, name, stance, trade, avatar)
    values (pg_temp.ws('initech'), pg_temp.made('erp'), 'Direct', 'excited', 'driver', pg_temp.face());
    raise exception 'FAIL: the table took excited';
  exception when check_violation then null; end;
  begin
    insert into public.personas (workspace_id, product_id, name, stance, trade, avatar)
    values (pg_temp.ws('initech'), pg_temp.made('erp'), 'Direct', 'neutral', 'analyst-', pg_temp.face());
    raise exception 'FAIL: the table took the trade analyst-';
  exception when check_violation then null; end;
  if exists (select 1 from public.personas where stance = 'excited') then
    raise exception 'FAIL: a persona is still excited';
  end if;
end $$;

-- The migration's rename, run again on two personas stored as before it, one live and one deleted, on
-- the product that goes next. The rule is lifted for this, inside the rolled-back transaction, then put
-- back as the migration left it.
alter table public.personas drop constraint personas_stance_check;
insert into public.personas (workspace_id, product_id, name, stance, trade, avatar, who, usage, deleted_at)
values (pg_temp.ws('initech'), pg_temp.made('loop'), 'Old Fan', 'excited', 'driver', pg_temp.face(1), 'Drives the vans', 'Every day', null),
       (pg_temp.ws('initech'), pg_temp.made('loop'), 'Gone Fan', 'excited', 'roofer', pg_temp.face(2), '', '', now());
do $$
declare
  was_count bigint := pg_temp.persona_events();
  e record;
  moved integer;
begin
  -- Mo is still signed in on this transaction: the rename names nobody all the same.
  moved := public.persona_stance_rename();
  if moved <> 2 or exists (select 1 from public.personas where stance = 'excited')
     or (select count(*) from public.personas where name in ('Old Fan', 'Gone Fan') and stance = 'enthusiastic') <> 2 then
    raise exception 'FAIL: the rename moved % personas, not the live and the deleted one', moved;
  end if;
  if pg_temp.persona_events() <> was_count + 2 then
    raise exception 'FAIL: the rename did not append one event per moved persona';
  end if;
  for e in select x.action, x.changed_by, x.before, x.after, p.name
             from public.product_knowledge_events x join public.personas p on p.id = x.persona_id
            where x.id > (select max(y.id) - 2 from public.product_knowledge_events y) loop
    if e.action <> 'edited' or e.changed_by is not null or e.before->>'stance' <> 'excited' or e.after->>'stance' <> 'enthusiastic'
       or e.before - 'stance' <> e.after - 'stance' or e.after->>'name' <> e.name then
      raise exception 'FAIL: the rename recorded % as % % % %', e.name, e.action, e.changed_by, e.before, e.after;
    end if;
  end loop;
  if public.persona_stance_rename() <> 0 then
    raise exception 'FAIL: the rename moved a persona twice';
  end if;
end $$;
alter table public.personas add constraint personas_stance_check check (stance in ('enthusiastic', 'neutral', 'skeptical'));

-- Nobody signed in runs the rename or writes the history.
set local role authenticated;
do $$
begin
  perform pg_temp.forbidden('select public.persona_stance_rename()', 'Mo');
  perform pg_temp.forbidden(format('select public.persona_log(p, ''added'', null, null) from public.personas p where p.id = %L', pg_temp.made('marc')), 'Mo');
  perform pg_temp.forbidden(format('insert into public.product_knowledge_events (workspace_id, product_id, kind, action, persona_id) values (%L, %L, ''persona'', ''added'', %L)',
                                   pg_temp.ws('initech'), pg_temp.made('erp'), pg_temp.made('marc')), 'Mo');
end $$;

-- ── PRD 2779: who reads the persona history ──
do $$
begin
  if (select count(*) from public.product_knowledge_events e where e.kind = 'persona') <> pg_temp.persona_events() then
    raise exception 'FAIL: a member does not read their workspace''s persona history';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000079c1');
  if exists (select 1 from public.product_knowledge_events e where e.kind = 'persona') then
    raise exception 'FAIL: a member of another workspace reads Initech''s persona history';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000079d1');
  if exists (select 1 from public.product_knowledge_events e where e.kind = 'persona') then
    raise exception 'FAIL: someone in no workspace reads Initech''s persona history';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000079b1');
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
  p := public.persona_add(pg_temp.ws('initech'), pg_temp.made('erp'), 'Imported', 'neutral', 'driver', pg_temp.face(), '', '');
  if p.created_by is not null then raise exception 'FAIL: an imported persona names a person: %', p; end if;
  -- PRD 2779: the import is recorded too, by nobody.
  if (pg_temp.last_event()).persona_id <> p.id or (pg_temp.last_event()).action <> 'added' or (pg_temp.last_event()).changed_by is not null then
    raise exception 'FAIL: the import was not recorded as added by nobody: %', pg_temp.last_event();
  end if;
  perform pg_temp.invalid(format('select public.persona_add(%L, %L, ''Bad'', ''angry'', ''driver'', %L, '''', '''')',
                                 pg_temp.ws('initech'), pg_temp.made('erp'), pg_temp.face()), 'stance');
  begin
    insert into public.personas (workspace_id, product_id, name, stance, trade, avatar)
    values (pg_temp.ws('initech'), pg_temp.made('erp'), 'Direct', 'neutral', 'driver', pg_temp.face());
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
    format('select public.persona_add(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('initech'), pg_temp.made('erp'), pg_temp.face()),
    format('select public.persona_edit(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('initech'), pg_temp.made('marc'), pg_temp.face()),
    format('select public.persona_delete(%L, %L)', pg_temp.ws('initech'), pg_temp.made('marc')),
    format('select public.persona_restore(%L, %L)', pg_temp.ws('initech'), pg_temp.made('marc')),
    format('select public.persona_find(%L, %L, ''Marc'')', pg_temp.ws('initech'), pg_temp.made('erp'))
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
      format('select public.persona_add(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('initech'), pg_temp.made('erp'), pg_temp.face()),
      format('select public.persona_edit(%L, %L, ''Eve'', ''neutral'', ''plumber'', %L, '''', '''')', pg_temp.ws('initech'), pg_temp.made('marc'), pg_temp.face()),
      format('select public.persona_delete(%L, %L)', pg_temp.ws('initech'), pg_temp.made('marc')),
      format('select public.persona_restore(%L, %L)', pg_temp.ws('initech'), pg_temp.made('marc')),
      format('select public.persona_find(%L, %L, ''Marc'')', pg_temp.ws('initech'), pg_temp.made('erp')),
      'select public.business_for_repo(''initech/nimbus-apps'')'
    ] loop perform pg_temp.forbidden(c, who); end loop;
    if exists (select 1 from public.personas) then
      raise exception 'FAIL: % reads Initech''s personas', who;
    end if;
    -- A member of Initech writes nothing directly either.
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
