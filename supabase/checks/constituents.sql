-- Who may read and write a product's constituents, and what the terminal and the App read of them (PRD
-- 871, 20261029090000_constituents.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/constituents.sql
-- Only an owner of the workspace adds, edits and removes its products' Statement and Never lines, through
-- constituent_add(), constituent_edit() and constituent_remove(); a member, an owner of another workspace
-- and anyone signed out are refused (42501), and nothing changes. Each write leaves exactly one event with
-- its text before and after, and the same text again leaves none. A removed line keeps its row and id,
-- and the next line takes a new id. Every member reads both tables; the terminal's read
-- (constituents_for_repo) answers a member's repository's product and refuses anyone else; the App's
-- (constituents_for_repo_app) runs for the service role only. The move turns each confirmed `never`
-- claim into a Never line with a `moved` event and leaves the claim `rejected`, and moves nothing twice.
-- `constituent-break` is a Jev decision name. Nobody writes either table directly, and nobody rewrites
-- an event. Nothing is seeded.
--
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── Nothing seeded ──
do $$
begin
  if exists (select 1 from public.constituents) or exists (select 1 from public.constituent_events) then
    raise exception 'FAIL: a constituent or event exists before any owner wrote one';
  end if;
  if not ('constituent-break' = any (public.jev_decision_names())) then
    raise exception 'FAIL: constituent-break is not a Jev decision name: %', public.jev_decision_names();
  end if;
end $$;

-- ── The cast ──
-- Olga owns Vertuoza (github_org vertuoza) and Mo is a member of it; Carl owns Acme; Sam belongs to no
-- workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000087a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000087b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000087c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000087d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-con', 'Acme', 'acme-con');
update public.workspaces set github_org = 'vertuoza' where slug = 'vertuoza' and github_org is null;
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000087a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000000087b1'::uuid, 'member'),
         ('acme-con', '00000000-0000-4000-8000-0000000087c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;
insert into public.repositories (workspace_id, full_name)
select w.id, 'vertuoza/con-web' from public.workspaces w where w.slug = 'vertuoza'
on conflict do nothing;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-con');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- What the owner made, read back by later blocks and outsiders' calls.
create temporary table made (name text primary key, id uuid);
grant select, insert, update on made to anon, authenticated, service_role;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;
create function pg_temp.invalid(stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % was taken', stmt;
exception when invalid_parameter_value then null;
end;
$$;
create function pg_temp.gone(stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % found a line that is gone', stmt;
exception when no_data_found then null;
end;
$$;
-- Everything the store holds, as one value to compare before and after a refusal.
create function pg_temp.store() returns text language sql security definer as $$
  select concat_ws('|',
    (select string_agg(row(c.*)::text, ';' order by c.id) from public.constituents c),
    (select string_agg(row(e.*)::text, ';' order by e.id) from public.constituent_events e));
$$;
-- How many events a constituent has.
create function pg_temp.events(constituent uuid) returns bigint language sql security definer as $$
  select count(*) from public.constituent_events e where e.constituent_id = constituent;
$$;

-- ── The business, opened by the owner (its first product serves vertuoza/con-web) ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000087a1');
do $$
declare
  b public.businesses := public.business_open(pg_temp.ws('vertuoza'));
begin
  insert into made select 'product', p.id from public.products p where p.business_id = b.id order by p.ordinal limit 1;
  if (select r.product_id from public.repositories r where r.full_name = 'vertuoza/con-web') is distinct from pg_temp.made('product') then
    raise exception 'FAIL: vertuoza/con-web does not serve the first product';
  end if;
end $$;
reset role;

-- ── Signed out: no function runs, nothing is read ──
set local role anon;
do $$
declare c text;
begin
  foreach c in array array[
    format('select public.constituent_add(%L, %L, ''never'', ''Planted'')', pg_temp.ws('vertuoza'), pg_temp.made('product')),
    'select public.constituents_for_repo(''vertuoza/con-web'')',
    'select public.constituents_for_repo_app(''vertuoza/con-web'')',
    'select public.constituents_move_never_claims()'
  ] loop perform pg_temp.forbidden(c, 'anon'); end loop;
  begin perform 1 from public.constituents; raise exception 'FAIL: anon read public.constituents';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.constituent_events; raise exception 'FAIL: anon read public.constituent_events';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The owner adds, edits and removes; each write leaves exactly one event ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000087a1');
do $$
declare
  ws uuid := pg_temp.ws('vertuoza');
  product uuid := pg_temp.made('product');
  c public.constituents;
  e public.constituent_events;
  got jsonb;
begin
  got := public.constituents_for_repo('vertuoza/con-web');
  if got <> jsonb_build_object('state', 'none', 'product', jsonb_build_object('name', (select p.name from public.products p where p.id = product)),
                               'statement', null, 'never', '[]'::jsonb, 'latestEventId', null) then
    raise exception 'FAIL: the read of a product with no constituent: %', got;
  end if;

  c := public.constituent_add(ws, product, 'statement', '  The component workshop, with fixtures  ');
  if c.kind <> 'statement' or c.seq is not null or c.body <> 'The component workshop, with fixtures' or c.removed_at is not null
     or c.created_by <> '00000000-0000-4000-8000-0000000087a1' then
    raise exception 'FAIL: the added Statement: %', c;
  end if;
  insert into made values ('statement', c.id);
  select * into e from public.constituent_events x where x.constituent_id = c.id;
  if pg_temp.events(c.id) <> 1 or e.action <> 'added' or e.before is not null or e.after <> c.body
     or e.changed_by <> '00000000-0000-4000-8000-0000000087a1' or e.product_id <> product then
    raise exception 'FAIL: adding the Statement did not log one `added` event: %', e;
  end if;

  c := public.constituent_add(ws, product, 'never', 'Calls real Vertuoza APIs');
  if c.kind <> 'never' or c.seq <> 1 then raise exception 'FAIL: the first Never line is not never#1: %', c; end if;
  insert into made values ('never-1', c.id);
  c := public.constituent_add(ws, product, 'never', 'Holds business logic');
  if c.seq <> 2 then raise exception 'FAIL: the second Never line is not never#2: %', c; end if;
  insert into made values ('never-2', c.id);
  if pg_temp.events(pg_temp.made('never-1')) <> 1 or pg_temp.events(pg_temp.made('never-2')) <> 1 then
    raise exception 'FAIL: adding a Never line did not log exactly one event';
  end if;

  -- Edit: before and after; the same text again changes nothing and logs nothing.
  c := public.constituent_edit(ws, pg_temp.made('statement'), 'The component workshop for Vertuoza');
  select * into e from public.constituent_events x where x.constituent_id = c.id order by x.id desc limit 1;
  if c.body <> 'The component workshop for Vertuoza' or pg_temp.events(c.id) <> 2 or e.action <> 'edited'
     or e.before <> 'The component workshop, with fixtures' or e.after <> 'The component workshop for Vertuoza' then
    raise exception 'FAIL: editing the Statement did not log one `edited` event with before and after: % %', c, e;
  end if;
  c := public.constituent_edit(ws, pg_temp.made('statement'), ' The component workshop for Vertuoza ');
  if pg_temp.events(c.id) <> 2 then raise exception 'FAIL: the same text again logged an event'; end if;

  -- Remove: the row and its id are kept, the event carries the text it had; the next line is never#3.
  c := public.constituent_remove(ws, pg_temp.made('never-2'));
  select * into e from public.constituent_events x where x.constituent_id = c.id order by x.id desc limit 1;
  if c.removed_at is null or c.removed_by <> '00000000-0000-4000-8000-0000000087a1' or c.seq <> 2
     or pg_temp.events(c.id) <> 2 or e.action <> 'removed' or e.before <> 'Holds business logic' or e.after is not null then
    raise exception 'FAIL: removing never#2 did not keep the row and log one `removed` event: % %', c, e;
  end if;
  if not exists (select 1 from public.constituents x where x.id = pg_temp.made('never-2')) then
    raise exception 'FAIL: a removed line was deleted';
  end if;
  c := public.constituent_add(ws, product, 'never', 'Holds business logic');
  if c.seq <> 3 then raise exception 'FAIL: the line after a removal reused an id: never#%', c.seq; end if;
  insert into made values ('never-3', c.id);

  -- A removed line takes no edit and no second removal; a second Statement is refused while one lives.
  perform pg_temp.gone(format('select public.constituent_edit(%L, %L, ''Back'')', ws, pg_temp.made('never-2')));
  perform pg_temp.gone(format('select public.constituent_remove(%L, %L)', ws, pg_temp.made('never-2')));
  perform pg_temp.gone(format('select public.constituent_add(%L, gen_random_uuid(), ''never'', ''No product'')', ws));
  perform pg_temp.invalid(format('select public.constituent_add(%L, %L, ''statement'', ''A second one'')', ws, product));
  perform pg_temp.invalid(format('select public.constituent_add(%L, %L, ''always'', ''A kind'')', ws, product));
  perform pg_temp.invalid(format('select public.constituent_add(%L, %L, ''never'', %L)', ws, product, repeat('x', 201)));
  perform pg_temp.invalid(format('select public.constituent_add(%L, %L, ''never'', %L)', ws, product, E'two\nlines'));
  perform pg_temp.invalid(format('select public.constituent_add(%L, %L, ''never'', ''  '')', ws, product));
  perform pg_temp.invalid(format('select public.constituent_edit(%L, %L, %L)', ws, pg_temp.made('statement'), repeat('x', 401)));
  c := public.constituent_add(ws, product, 'never', repeat('n', 200));
  insert into made values ('never-4', c.id);
  if char_length(c.body) <> 200 then raise exception 'FAIL: a Never line of 200 characters was not kept'; end if;

  -- The terminal's read: the live Statement and Never lines, in order, and the newest event.
  got := public.constituents_for_repo('Vertuoza/Con-Web');
  if got->>'state' <> 'ok'
     or got->'statement' <> '{"id": "statement", "text": "The component workshop for Vertuoza"}'::jsonb
     or (select string_agg(x->>'id', ',') from jsonb_array_elements(got->'never') x) <> 'never#1,never#3,never#4'
     or got->'never'->0->>'text' <> 'Calls real Vertuoza APIs'
     or got->>'latestEventId' <> (select max(x.id)::text from public.constituent_events x where x.product_id = product) then
    raise exception 'FAIL: the terminal''s read: %', got;
  end if;
end $$;
reset role;

-- ── A member reads both tables and the terminal's read, and writes nothing ──
create temporary table before_refusals as select pg_temp.store() as s;
grant select on before_refusals to anon, authenticated, service_role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000087b1');
do $$
declare
  ws uuid := pg_temp.ws('vertuoza');
  c text;
begin
  if (select count(*) from public.constituents) <> 5 or (select count(*) from public.constituent_events) <> 7 then
    raise exception 'FAIL: a member does not read every constituent and event: % %',
      (select count(*) from public.constituents), (select count(*) from public.constituent_events);
  end if;
  if public.constituents_for_repo('vertuoza/con-web')->>'state' <> 'ok' then
    raise exception 'FAIL: a member cannot read the terminal''s read';
  end if;
  foreach c in array array[
    format('select public.constituent_add(%L, %L, ''never'', ''Planted'')', ws, pg_temp.made('product')),
    format('select public.constituent_edit(%L, %L, ''Planted'')', ws, pg_temp.made('statement')),
    format('select public.constituent_remove(%L, %L)', ws, pg_temp.made('never-1')),
    'select public.constituents_for_repo_app(''vertuoza/con-web'')',
    'select public.constituents_move_never_claims()',
    format('insert into public.constituents (workspace_id, product_id, kind, seq, body) values (%L, %L, ''never'', 9, ''Planted'')', ws, pg_temp.made('product')),
    format('update public.constituents set body = ''Planted'' where id = %L', pg_temp.made('never-1')),
    'update public.constituent_events set after = ''Planted''',
    'delete from public.constituent_events',
    'delete from public.constituents'
  ] loop perform pg_temp.forbidden(c, 'a member'); end loop;
end $$;
reset role;

-- ── An owner of another workspace and a stranger: refused, and they read nothing ──
set local role authenticated;
do $$
declare
  ws uuid := pg_temp.ws('vertuoza');
  who text;
  c text;
begin
  foreach who in array array['00000000-0000-4000-8000-0000000087c1', '00000000-0000-4000-8000-0000000087d1'] loop
    perform pg_temp.sign_in(who);
    foreach c in array array[
      format('select public.constituent_add(%L, %L, ''never'', ''Planted'')', ws, pg_temp.made('product')),
      format('select public.constituent_edit(%L, %L, ''Planted'')', ws, pg_temp.made('statement')),
      format('select public.constituent_remove(%L, %L)', ws, pg_temp.made('never-1')),
      'select public.constituents_for_repo(''vertuoza/con-web'')'
    ] loop perform pg_temp.forbidden(c, who); end loop;
    if exists (select 1 from public.constituents) or exists (select 1 from public.constituent_events) then
      raise exception 'FAIL: % reads Vertuoza''s constituents', who;
    end if;
  end loop;
  -- Carl owns Acme, so he passes the owner check there, but Vertuoza's product is not Acme's.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000000087c1');
  perform pg_temp.gone(format('select public.constituent_add(%L, %L, ''never'', ''Planted'')', pg_temp.ws('acme-con'), pg_temp.made('product')));
  perform pg_temp.gone(format('select public.constituent_remove(%L, %L)', pg_temp.ws('acme-con'), pg_temp.made('never-1')));
end $$;
reset role;

do $$
begin
  if pg_temp.store() <> (select s from before_refusals) then
    raise exception 'FAIL: a refused call changed the constituents';
  end if;
end $$;

-- ── The App's read, with the service role, by repository ──
set local role service_role;
do $$
declare
  got jsonb;
  repo text;
begin
  got := public.constituents_for_repo_app('vertuoza/con-web');
  if got <> (select public.constituents_of_product(pg_temp.made('product'))) or got->>'state' <> 'ok' then
    raise exception 'FAIL: the App''s read of con-web: %', got;
  end if;
  foreach repo in array array['vertuoza/nowhere', 'acme-con/web'] loop
    got := public.constituents_for_repo_app(repo);
    if got <> '{"state": "none", "product": null, "statement": null, "never": [], "latestEventId": null}'::jsonb then
      raise exception 'FAIL: the App read something for %: %', repo, got;
    end if;
  end loop;
  perform pg_temp.invalid('select public.constituents_for_repo_app(''not a repository'')');
  perform pg_temp.forbidden(format('select public.constituent_add(%L, %L, ''never'', ''Planted'')', pg_temp.ws('vertuoza'), pg_temp.made('product')), 'the service role');
  perform pg_temp.forbidden('select public.constituents_move_never_claims()', 'the service role');
  begin
    insert into public.constituent_events (workspace_id, product_id, constituent_id, action, after)
    values (pg_temp.ws('vertuoza'), pg_temp.made('product'), pg_temp.made('never-1'), 'added', 'Planted');
    raise exception 'FAIL: the service role wrote an event directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The move: confirmed `never` claims become Never lines, each `moved`, the claim kept `rejected` ──
-- The claims below are what a business held before this migration: written directly, as only a
-- migration could now, since claim_pick() and claim_propose_evidence() refuse `never`.
do $$
declare
  product uuid := pg_temp.made('product');
  biz uuid := (select p.business_id from public.products p where p.id = product);
  moved integer;
  c public.constituents;
  e public.constituent_events;
begin
  insert into public.claims (workspace_id, business_id, product_id, seq, kind, value, source, state, created_by) values
    (pg_temp.ws('vertuoza'), biz, product, 41, 'never', 'Build for groups of companies', 'pick', 'confirmed', '00000000-0000-4000-8000-0000000087b1'),
    (pg_temp.ws('vertuoza'), biz, product, 42, 'never', 'Sell to accountants', 'evidence', 'proposed', null),
    (pg_temp.ws('vertuoza'), biz, product, 43, 'never', 'Build a mobile game', 'pick', 'confirmed', '00000000-0000-4000-8000-0000000087a1'),
    (pg_temp.ws('vertuoza'), biz, product, 44, 'never', 'Ship without tests', 'pick', 'rejected', null);

  moved := public.constituents_move_never_claims();
  if moved <> 2 then raise exception 'FAIL: the move moved % claims, not the 2 confirmed ones', moved; end if;

  select * into c from public.constituents x where x.product_id = product and x.body = 'Build for groups of companies';
  select * into e from public.constituent_events x where x.constituent_id = c.id;
  if c.kind <> 'never' or c.seq <> 5 or c.removed_at is not null or pg_temp.events(c.id) <> 1
     or e.action <> 'moved' or e.before is not null or e.after <> 'Build for groups of companies'
     or e.note <> 'moved from Business never#41' or e.claim_id is distinct from (select x.id from public.claims x where x.business_id = biz and x.seq = 41)
     or e.changed_by is not null then
    raise exception 'FAIL: the first confirmed claim did not move to never#5 with one `moved` event: % %', c, e;
  end if;
  if (select x.seq from public.constituents x where x.product_id = product and x.body = 'Build a mobile game') <> 6 then
    raise exception 'FAIL: the second confirmed claim did not move next, in order';
  end if;
  if exists (select 1 from public.claims x where x.business_id = biz and x.seq in (41, 43) and x.state <> 'rejected') then
    raise exception 'FAIL: a moved claim was not left rejected';
  end if;
  if (select x.state from public.claims x where x.business_id = biz and x.seq = 42) <> 'proposed'
     or exists (select 1 from public.constituents x where x.body in ('Sell to accountants', 'Ship without tests')) then
    raise exception 'FAIL: a claim that was not confirmed moved';
  end if;
  if public.constituents_move_never_claims() <> 0 then
    raise exception 'FAIL: a second move moved something';
  end if;
end $$;

-- ── claim_pick and claim_propose_evidence refuse kind `never` (business.sql proves the rest) ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000087a1');
select pg_temp.invalid(format('select public.claim_pick(%L, %L, ''never'', ''Planted'', ''pick'')', pg_temp.ws('vertuoza'), pg_temp.made('product')));
reset role;

rollback;

\echo 'constituents: every check passed'
