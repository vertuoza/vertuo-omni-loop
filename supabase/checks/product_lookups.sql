-- Every product lookup resolves PRD, then repository, then none (PRD 1364 s3). The supabase workflow runs
-- it on every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/product_lookups.sql
-- business_for_repo(), business_for_token(), constituents_for_repo(), pitch_look_for_repo(),
-- pitch_settings_for_repo() and claim_answer() take the PRD a call is for (p_prd): a PRD the server holds
-- answers with its own product, or with none when it has none; a call that names no PRD, or one the
-- server does not hold, takes the repository's only product, and a repository in no product or in
-- several takes none. dossier_approve() and approval_request() read the PRD's own product. So a PRD in a
-- repository linked to two products reads its own product's approvers, claims, personas, constituents
-- and pitch. business_for_token() with several products and no repository answers with no product
-- instead of raising, and a PRD it is given without its repository is refused. With no product, any
-- member approves and the author alone is asked, as before. The App's reads (business_for_repo_app(),
-- constituents_for_repo_app()) and an agent question take the repository's only product. One
-- transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns PL; Mo, Irisa and Ada are members, Ada writes the PRDs. PL sells Mobile and Estimates:
-- Irisa approves Mobile's PRDs, Mo approves Estimates'. pl-org/api is in both, pl-org/solo in Mobile
-- alone, pl-org/lone in none.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000013643a1', 'olga@pl.test'),
  ('00000000-0000-4000-8000-0000013643b1', 'mo@pl.test'),
  ('00000000-0000-4000-8000-0000013643b2', 'irisa@pl.test'),
  ('00000000-0000-4000-8000-0000013643b3', 'ada@pl.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000001364300', 'pl', 'PL', 'pl-org');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643a1', 'owner'),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643b1', 'member'),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643b2', 'member'),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643b3', 'member');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000013643f0', '00000000-0000-4000-8000-000001364300', 'PL');
insert into public.products (id, workspace_id, business_id, name, pitch_look, pitch) values
  ('00000000-0000-4000-8000-0000013643e1', '00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643f0', 'Mobile', 'arcade', '{}'),
  ('00000000-0000-4000-8000-0000013643e2', '00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643f0', 'Estimates', 'keynote', '{"look": {"preset": "keynote"}}');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000001364300', 'pl-org/api'),
  ('00000000-0000-4000-8000-000001364300', 'pl-org/solo'),
  ('00000000-0000-4000-8000-000001364300', 'pl-org/lone');
insert into public.product_repositories (product_id, workspace_id, repository, role, added_by) values
  ('00000000-0000-4000-8000-0000013643e1', '00000000-0000-4000-8000-000001364300', 'pl-org/api', 'api', 'person'),
  ('00000000-0000-4000-8000-0000013643e2', '00000000-0000-4000-8000-000001364300', 'pl-org/api', 'api', 'person'),
  ('00000000-0000-4000-8000-0000013643e1', '00000000-0000-4000-8000-000001364300', 'pl-org/solo', 'mobile', 'person');
insert into public.product_approvers (workspace_id, product_id, user_id, state) values
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643e1', '00000000-0000-4000-8000-0000013643b2', 'asked'),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643e2', '00000000-0000-4000-8000-0000013643b1', 'asked');
-- The business's region, and an offering, a persona and a statement on each product.
insert into public.claims (workspace_id, business_id, product_id, seq, kind, value, source, state) values
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643f0', null, 1, 'region', 'Belgium', 'pick', 'confirmed'),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643f0', '00000000-0000-4000-8000-0000013643e1', 2, 'offering', 'Phones', 'pick', 'confirmed'),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643f0', '00000000-0000-4000-8000-0000013643e2', 3, 'offering', 'Quotes', 'pick', 'confirmed');
insert into public.personas (workspace_id, product_id, name, stance, trade, avatar) values
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643e1', 'Rider', 'excited', 'driver',
   jsonb_build_object('v', 1, 'skin', 0, 'hair', 2, 'hairColor', 1, 'outfit', 3, 'accessory', 0)),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643e2', 'Estimator', 'neutral', 'builder',
   jsonb_build_object('v', 1, 'skin', 1, 'hair', 2, 'hairColor', 1, 'outfit', 3, 'accessory', 0));
insert into public.constituents (workspace_id, product_id, kind, body) values
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643e1', 'statement', 'Mobile, for crews on site.'),
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643e2', 'statement', 'Estimates, for the office.');
-- An agent's link of PL, made by Olga.
insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four) values
  ('00000000-0000-4000-8000-000001364300', '00000000-0000-4000-8000-0000013643a1', 'Lookups', repeat('a', 64), 'aaaa');

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;
-- What a business read names: its product (or none), its claims and its personas, on one line.
create function pg_temp.read(got jsonb) returns text language sql as $$
  select coalesce(got -> 'product' ->> 'name', 'none') || ' · '
      || coalesce((select string_agg(c ->> 'value', ',' order by o) from jsonb_array_elements(got -> 'claims') with ordinality as x (c, o)), '') || ' · '
      || coalesce((select string_agg(p ->> 'name', ',') from jsonb_array_elements(got -> 'personas') p), '');
$$;
-- Runs a call that must be refused with `code`.
create function pg_temp.refused(stmt text, code text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
end;
$$;
grant execute on function pg_temp.refused(text, text, text) to anon, authenticated;
create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- ── Ada pushes five server-born PRDs ──
-- 1 in pl-org/api naming Estimates; 2 in pl-org/api naming nothing (none); 3 in pl-org/solo (Mobile,
-- its only product); 4 in pl-org/lone (none); 5 in pl-org/solo, then moved to No product.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000013643b3', 'ada@pl.test');
do $$
declare
  spot record;
  made jsonb;
begin
  for spot in select * from (values (1, 'pl-org/api', 'Estimates'), (2, 'pl-org/api', null), (3, 'pl-org/solo', null),
                                    (4, 'pl-org/lone', null), (5, 'pl-org/solo', null)) as s (prd, repo, product) loop
    made := public.dossier_push(spot.repo, spot.prd, 'Lookup ' || spot.prd, null, jsonb_build_array(
      jsonb_build_object('kind', 'spec', 'content', format(E'---\nprd: %s\nphase0: server\n---\n\n# Lookup\n', spot.prd)),
      jsonb_build_object('kind', 'plan', 'content', 'plan'),
      jsonb_build_object('kind', 'before-after', 'content', '<p>before</p>')), 'prd', spot.product);
    insert into ids values ('prd-' || spot.prd, (made ->> 'id')::uuid);
  end loop;
  perform public.dossier_set_product((select id from ids where name = 'prd-5'), null);
  if (select string_agg(coalesce(p.name, 'none'), ',' order by d.prd)
        from public.dossiers d left join public.products p on p.id = d.product_id
       where d.workspace_id = '00000000-0000-4000-8000-000001364300') <> 'Estimates,none,Mobile,none,none' then
    raise exception 'FAIL: the PRDs were not born with Estimates, none, Mobile, none, none';
  end if;
end $$;

-- ── business_for_repo(): PRD, then repository, then none ──
do $$
declare
  got text;
begin
  got := pg_temp.read(public.business_for_repo('pl-org/api', 1));
  if got <> 'Estimates · Belgium,Quotes · Estimator' then
    raise exception 'FAIL: business_for_repo for PRD 1, Estimates'' in a repository of two products: %', got;
  end if;
  got := pg_temp.read(public.business_for_repo('pl-org/api', 2));
  if got <> 'none · Belgium · ' then raise exception 'FAIL: business_for_repo for PRD 2, of no product: %', got; end if;
  got := pg_temp.read(public.business_for_repo('pl-org/api'));
  if got <> 'none · Belgium · ' then
    raise exception 'FAIL: business_for_repo in a repository of two products, naming no PRD: %', got;
  end if;
  got := pg_temp.read(public.business_for_repo('pl-org/solo'));
  if got <> 'Mobile · Belgium,Phones · Rider' then
    raise exception 'FAIL: business_for_repo in a repository of one product: %', got;
  end if;
  got := pg_temp.read(public.business_for_repo('pl-org/solo', 99));
  if got <> 'Mobile · Belgium,Phones · Rider' then
    raise exception 'FAIL: business_for_repo for a PRD the server does not hold: %', got;
  end if;
  got := pg_temp.read(public.business_for_repo('pl-org/solo', 5));
  if got <> 'none · Belgium · ' then
    raise exception 'FAIL: business_for_repo for a PRD moved to no product, in a repository of one: %', got;
  end if;
  got := pg_temp.read(public.business_for_repo('pl-org/lone', 4));
  if got <> 'none · Belgium · ' then raise exception 'FAIL: business_for_repo in a repository of no product: %', got; end if;
end $$;

-- ── The other reads of a terminal: constituents, pitch, a claim answered ──
do $$
declare
  got jsonb;
begin
  if public.constituents_for_repo('pl-org/api', 1) -> 'statement' ->> 'text' <> 'Estimates, for the office.'
     or public.constituents_for_repo('pl-org/solo') -> 'statement' ->> 'text' <> 'Mobile, for crews on site.'
     or public.constituents_for_repo('pl-org/api') ->> 'state' <> 'none'
     or public.constituents_for_repo('pl-org/api', 2) ->> 'state' <> 'none' then
    raise exception 'FAIL: constituents_for_repo does not read PRD, repository, none';
  end if;
  if public.pitch_look_for_repo('pl-org/api', 1) <> 'keynote' or public.pitch_look_for_repo('pl-org/api') <> 'arcade'
     or public.pitch_settings_for_repo('pl-org/api', 1) <> '{"look": {"preset": "keynote"}}'::jsonb
     or public.pitch_settings_for_repo('pl-org/api') <> '{}'::jsonb
     or public.pitch_settings_for_repo('pl-org/solo') <> '{}'::jsonb then
    raise exception 'FAIL: the pitch reads do not follow PRD, repository, none';
  end if;
  got := public.claim_answer('pl-org/api', 'rival', 'Rival Quotes', 'confirmed', 'brainstorm · PRD 1', 1);
  if (select c.product_id from public.claims c where c.value = 'Rival Quotes') <> '00000000-0000-4000-8000-0000013643e2' then
    raise exception 'FAIL: an answer for PRD 1 was not put on Estimates: %', got;
  end if;
  got := public.claim_answer('pl-org/solo', 'rival', 'Rival Phones', 'confirmed', 'brainstorm');
  if (select c.product_id from public.claims c where c.value = 'Rival Phones') <> '00000000-0000-4000-8000-0000013643e1' then
    raise exception 'FAIL: an answer in a repository of one product was not put on it: %', got;
  end if;
end $$;
reset role;

-- ── business_for_token(): the same order, and none instead of a refusal on several products ──
set local role anon;
do $$
declare
  got text;
  hash constant text := repeat('a', 64);
begin
  got := pg_temp.read(public.business_for_token(hash, 'pl-org/api', 1));
  if got <> 'Estimates · Belgium,Quotes,Rival Quotes · Estimator' then
    raise exception 'FAIL: business_for_token for PRD 1: %', got;
  end if;
  got := pg_temp.read(public.business_for_token(hash, 'pl-org/solo'));
  if got <> 'Mobile · Belgium,Phones,Rival Phones · Rider' then
    raise exception 'FAIL: business_for_token in a repository of one product: %', got;
  end if;
  got := pg_temp.read(public.business_for_token(hash, 'pl-org/api', 2));
  if got <> 'none · Belgium · ' then raise exception 'FAIL: business_for_token for a PRD of no product: %', got; end if;
  got := pg_temp.read(public.business_for_token(hash, 'pl-org/lone'));
  if got <> 'none · Belgium · ' then raise exception 'FAIL: business_for_token in a repository of no product: %', got; end if;
  got := pg_temp.read(public.business_for_token(hash));
  if got <> 'none · Belgium · ' then
    raise exception 'FAIL: business_for_token with several products and no repository: %', got;
  end if;
  perform pg_temp.refused(format('select public.business_for_token(%L, null, 1)', hash), '22023',
    'business_for_token naming a PRD and no repository');
end $$;
reset role;

-- ── dossier_approve(): the PRD's own product's approvers; with none, any member ──
set local role authenticated;
do $$
begin
  -- PRD 1 is Estimates': Irisa (Mobile's) is refused, Mo (Estimates') approves.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000013643b2', 'irisa@pl.test');
  perform pg_temp.refused(format('select public.dossier_approve(%L)', (select id from ids where name = 'prd-1')), '42501',
    'Mobile''s approver approving an Estimates PRD in a shared repository');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000013643b1', 'mo@pl.test');
  perform public.dossier_approve((select id from ids where name = 'prd-1'));
  -- PRD 3 is Mobile's, its repository's only product: Mo is refused, Irisa approves.
  perform pg_temp.refused(format('select public.dossier_approve(%L)', (select id from ids where name = 'prd-3')), '42501',
    'Estimates'' approver approving a Mobile PRD');
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000013643b2', 'irisa@pl.test');
  perform public.dossier_approve((select id from ids where name = 'prd-3'));
  -- PRD 2 (a shared repository) and PRD 5 (moved to no product) have none: any member approves.
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000013643a1', 'olga@pl.test');
  perform public.dossier_approve((select id from ids where name = 'prd-2'));
  perform public.dossier_approve((select id from ids where name = 'prd-5'));
  if (select count(*) from public.approvals a join ids i on i.id = a.dossier_id) <> 4 then
    raise exception 'FAIL: four approvals were not recorded';
  end if;
end $$;

-- ── approval_request(): the PRD's own product's approvers asked; with none, the author alone ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000013643b3', 'ada@pl.test');
do $$
declare
  made jsonb;
begin
  made := public.approval_request('pl-org/api', 1);
  if made ->> 'product' <> 'Estimates' or made -> 'asked' -> 0 ->> 'user' <> '00000000-0000-4000-8000-0000013643b1'
     or jsonb_array_length(made -> 'asked') <> 1 or (made ->> 'nobodyElse')::boolean then
    raise exception 'FAIL: PRD 1''s request asked % of %', made -> 'asked', made ->> 'product';
  end if;
  made := public.approval_request('pl-org/solo', 3);
  if made ->> 'product' <> 'Mobile' or made -> 'asked' -> 0 ->> 'user' <> '00000000-0000-4000-8000-0000013643b2'
     or jsonb_array_length(made -> 'asked') <> 1 then
    raise exception 'FAIL: PRD 3''s request asked % of %', made -> 'asked', made ->> 'product';
  end if;
  foreach made in array array[public.approval_request('pl-org/api', 2), public.approval_request('pl-org/solo', 5)] loop
    if made -> 'product' <> 'null'::jsonb or not (made ->> 'nobodyElse')::boolean
       or made -> 'asked' <> jsonb_build_array(jsonb_build_object('user', '00000000-0000-4000-8000-0000013643b3', 'login', 'ada@pl.test', 'name', null)) then
      raise exception 'FAIL: a PRD of no product asked % of %', made -> 'asked', made -> 'product';
    end if;
  end loop;
  if (select string_agg(coalesce(p.name, 'none'), ',' order by d.prd)
        from public.approval_requests r join public.dossiers d on d.id = r.dossier_id
        left join public.products p on p.id = r.product_id
       where r.workspace_id = '00000000-0000-4000-8000-000001364300') <> 'Estimates,none,Mobile,none' then
    raise exception 'FAIL: the requests do not record the PRDs'' products';
  end if;
end $$;
reset role;

-- ── The App's reads and agent questions: the repository's only product ──
set local role service_role;
do $$
begin
  if public.business_for_repo_app('pl-org/solo') -> 'product' ->> 'name' <> 'Mobile'
     or public.business_for_repo_app('pl-org/api') -> 'product' <> 'null'::jsonb
     or (select string_agg(p ->> 'name', ',') from jsonb_array_elements(public.business_for_repo_app('pl-org/api') -> 'personas') p) is not null then
    raise exception 'FAIL: business_for_repo_app does not read the repository''s only product, else none';
  end if;
  if public.constituents_for_repo_app('pl-org/solo') -> 'statement' ->> 'text' <> 'Mobile, for crews on site.'
     or public.constituents_for_repo_app('pl-org/api') ->> 'state' <> 'none' then
    raise exception 'FAIL: constituents_for_repo_app does not read the repository''s only product, else none';
  end if;
end $$;
reset role;
do $$
declare
  q public.agent_questions;
begin
  q.workspace_id := '00000000-0000-4000-8000-000001364300';
  q.repo := 'pl-org/solo';
  if public.agent_question_product(q, null) <> '00000000-0000-4000-8000-0000013643e1' then
    raise exception 'FAIL: an agent question in a repository of one product is not about it';
  end if;
  q.repo := 'pl-org/api';
  if public.agent_question_product(q, null) is not null then
    raise exception 'FAIL: an agent question in a repository of two products took one';
  end if;
  if public.agent_question_product(q, '00000000-0000-4000-8000-0000013643e2') <> '00000000-0000-4000-8000-0000013643e2' then
    raise exception 'FAIL: an agent question''s answer naming its product did not keep it';
  end if;
end $$;

-- ── Nothing reads repositories.product_id any more ──
do $$
declare
  reader text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into reader
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('business_for_repo', 'business_for_repo_app', 'business_for_token', 'claim_answer',
                       'agent_question_product', 'constituents_for_repo', 'constituents_for_repo_app',
                       'pitch_look_for_repo', 'pitch_settings_for_repo', 'dossier_approve', 'approval_request')
     and p.prosrc ~ 'r\.product_id';
  if reader is not null then
    raise exception 'FAIL: % still read repositories.product_id', reader;
  end if;
end $$;

rollback;
