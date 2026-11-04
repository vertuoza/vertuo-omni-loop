-- The business laws' verdicts on a ◆ PRD's spec, and the approval they hold (PRD 2632 s4). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/business_law_verdicts.sql
-- business_law_verdict_put(), the service role's alone, keeps one verdict per spec version and pack commit
-- of the law home, and the same two again keep the first: a verdict is never rewritten, and nobody updates
-- or deletes one, not even the table's owner. A malformed verdict is refused and nothing is written.
-- business_law_judge_input() gives the judge, and only the service role, the latest spec, the law home's
-- newest pack (its business-laws.md files and config only) and the glossary. A member reads the verdicts
-- (and business_law_verdict_of()); an account of another workspace and anyone signed out read nothing;
-- nobody signed in writes. dossier_approve() refuses a red at the law home's newest pack, and approves a
-- red at an older pack, a green, a neutral, an older commit's pack arriving late changing nothing, and a
-- product with no law home. A neutral stays the approved version's verdict afterward.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000026320a1', 'ada@blv.test'),
  ('00000000-0000-4000-8000-0000026320c1', 'carl@blv-other.test');
insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000026320a1', 'github', '26321', '{"sub": "26321", "user_name": "ada-blv"}', now(), now());
-- Blv owns the GitHub organisation blv; Ada belongs to it, Carl only to Other.
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002632000', 'blv', 'Blv', 'blv'),
  ('00000000-0000-4000-8000-000002632100', 'blv-other', 'Other', 'blv-other');
insert into public.workspace_members (workspace_id, user_id) values
  ('00000000-0000-4000-8000-000002632000', '00000000-0000-4000-8000-0000026320a1'),
  ('00000000-0000-4000-8000-000002632100', '00000000-0000-4000-8000-0000026320c1');
insert into public.businesses (workspace_id, name) values ('00000000-0000-4000-8000-000002632000', 'Blv');
insert into public.products (workspace_id, business_id, name, key)
select b.workspace_id, b.id, 'Quotes', 'quotes' from public.businesses b where b.workspace_id = '00000000-0000-4000-8000-000002632000';
-- Quotes holds blv/app and its plan repository, blv/plan: the law home.
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000002632000', 'blv/app'),
  ('00000000-0000-4000-8000-000002632000', 'blv/plan');
insert into public.product_repositories (product_id, workspace_id, repository, added_by)
select p.id, p.workspace_id, r.name, 'person'
  from public.products p cross join (values ('blv/app'), ('blv/plan')) as r (name)
 where p.workspace_id = '00000000-0000-4000-8000-000002632000';
update public.products set plan_repository = 'blv/plan' where workspace_id = '00000000-0000-4000-8000-000002632000';
insert into public.product_domains (workspace_id, product_id, key, name, meaning)
select p.workspace_id, p.id, 'quotes', 'Quotes', 'What a contractor sends before the work.'
  from public.products p where p.workspace_id = '00000000-0000-4000-8000-000002632000';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sha(c text) returns text language sql immutable as $$ select repeat(c, 40) $$;

-- Runs a call that must be refused with `code`, its message holding `words` when given.
create function pg_temp.refused(stmt text, code text, why text, words text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if words is not null and position(words in sqlerrm) = 0 then
    raise exception 'FAIL: % said "%", not naming "%"', why, sqlerrm, words;
  end if;
end;
$$;

-- The latest spec version of PRD 9.
create function pg_temp.spec() returns uuid language sql security definer as $$
  select v.id from public.dossier_versions v join public.dossiers d on d.id = v.dossier_id
   where d.home_repo = 'blv/app' and d.prd = 9 and v.kind = 'spec' order by v.created_at desc, v.id desc limit 1;
$$;
create function pg_temp.dossier() returns uuid language sql security definer as $$
  select d.id from public.dossiers d where d.home_repo = 'blv/app' and d.prd = 9;
$$;
create function pg_temp.verdicts() returns bigint language sql security definer as $$
  select count(*) from public.business_law_verdicts;
$$;

-- A finding on BL-QUOTES-1.
create function pg_temp.finding() returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object(
    'law', 'BL-QUOTES-1', 'statement', 'A quote is sent only with a total above zero.',
    'why', 'An empty quote loses the customer.', 'quote', 'sent with a zero total',
    'domain', 'quotes', 'file', '.omni-loop/knowledge/domains/quotes/business-laws.md', 'owners', jsonb_build_array('ana')));
$$;
create function pg_temp.put(version uuid, sha text, state text, findings jsonb default '[]') returns jsonb language sql as $$
  select public.business_law_verdict_put(version, sha, state, case state when 'neutral' then 'no model key on this deployment' else 'judged' end,
    '["BL-QUOTES-1", "BL-PRODUCT-1"]', '[{"key": "quotes", "reasons": ["\"Quote\""]}]', findings);
$$;
grant execute on function pg_temp.put(uuid, text, text, jsonb) to service_role;
grant execute on function pg_temp.finding() to service_role, authenticated;
grant execute on function pg_temp.spec() to service_role, authenticated;
grant execute on function pg_temp.dossier() to service_role, authenticated;
grant execute on function pg_temp.verdicts() to service_role, authenticated;

-- The law home's pack at commit `c`, made at `at`.
create function pg_temp.pack(c text, at timestamptz) returns jsonb language sql as $$
  select public.knowledge_pack_put('blv/plan', pg_temp.sha(c), at, jsonb_build_array(
    jsonb_build_object('path', '.omni-loop/knowledge/domains/quotes/business-laws.md',
                       'content', E'## BL-QUOTES-1\nA quote is sent only with a total above zero.\nWhy: An empty quote loses the customer.\n'),
    jsonb_build_object('path', '.omni-loop/knowledge/domains/quotes/rules.md', 'content', E'# Rules\n'),
    jsonb_build_object('path', '.omni-loop/config.yml', 'content', E'kit: 1\nlaws:\n  owners: [ana]\n')));
$$;
grant execute on function pg_temp.pack(text, timestamptz) to service_role;

-- ── Who may call what ──
do $$
begin
  if has_function_privilege('authenticated', 'public.business_law_verdict_put(uuid, text, text, text, jsonb, jsonb, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.business_law_verdict_put(uuid, text, text, text, jsonb, jsonb, jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.business_law_verdict_put(uuid, text, text, text, jsonb, jsonb, jsonb)', 'execute') then
    raise exception 'FAIL: business_law_verdict_put() is not the service role''s alone';
  end if;
  if has_function_privilege('authenticated', 'public.business_law_judge_input(uuid)', 'execute')
     or has_function_privilege('anon', 'public.business_law_judge_input(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.business_law_judge_input(uuid)', 'execute') then
    raise exception 'FAIL: business_law_judge_input() is not the service role''s alone';
  end if;
  if has_function_privilege('anon', 'public.business_law_verdict_of(uuid, uuid)', 'execute') then
    raise exception 'FAIL: anyone signed out may call business_law_verdict_of()';
  end if;
  if has_table_privilege('authenticated', 'public.business_law_verdicts', 'insert')
     or has_table_privilege('authenticated', 'public.business_law_verdicts', 'update')
     or has_table_privilege('authenticated', 'public.business_law_verdicts', 'delete')
     or has_table_privilege('service_role', 'public.business_law_verdicts', 'insert')
     or has_table_privilege('anon', 'public.business_law_verdicts', 'select') then
    raise exception 'FAIL: the verdicts are written other than through business_law_verdict_put()';
  end if;
end $$;

-- ── Ada pushes ◆ PRD 9; the law home's pack is kept at commit a ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
select public.dossier_push('blv/app', 9, 'Quote templates', null, jsonb_build_array(
  jsonb_build_object('kind', 'spec', 'content', E'---\nprd: 9\nphase0: server\n---\n\n## Solution\n\nA template is sent with a zero total.\n'),
  jsonb_build_object('kind', 'plan', 'content', 'plan'),
  jsonb_build_object('kind', 'before-after', 'content', '<p>before</p>')));
reset role;

set local role service_role;
select pg_temp.pack('a', '2026-12-01 09:00+00');
do $$
declare
  input jsonb := public.business_law_judge_input(pg_temp.dossier());
begin
  if (input ->> 'server')::boolean is distinct from true or input ->> 'lawHome' <> 'blv/plan'
     or input -> 'pack' ->> 'sha' <> pg_temp.sha('a') or (input ->> 'specVersion')::uuid <> pg_temp.spec()
     or input -> 'verdict' <> 'null'::jsonb or input ->> 'spec' not like '%zero total%' then
    raise exception 'FAIL: the judge read %', input - 'glossary';
  end if;
  if (select jsonb_agg(f ->> 'path') from jsonb_array_elements(input -> 'pack' -> 'files') f)
     <> '[".omni-loop/config.yml", ".omni-loop/knowledge/domains/quotes/business-laws.md"]'::jsonb then
    raise exception 'FAIL: the judge read the pack''s files %', input -> 'pack' -> 'files';
  end if;
  if input -> 'domains' <> '[{"key": "quotes", "name": "Quotes", "meaning": "What a contractor sends before the work."}]'::jsonb
     or jsonb_typeof(input -> 'glossary') <> 'array' then
    raise exception 'FAIL: the judge read the product''s domains % and glossary %', input -> 'domains', input -> 'glossary';
  end if;
  if public.business_law_judge_input(gen_random_uuid()) is not null then
    raise exception 'FAIL: the judge read a dossier that never was';
  end if;
end $$;
reset role;

-- ── Signed out, and signed in: nobody writes or reads what is not theirs ──
set local role anon;
do $$
begin
  perform pg_temp.refused('select 1 from public.business_law_verdicts', '42501', 'anon read the verdicts');
  perform pg_temp.refused(format('select public.business_law_verdict_of(%L)', pg_temp.dossier()), '42501', 'anon read a verdict');
end $$;
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
do $$
begin
  perform pg_temp.refused(format('select pg_temp.put(%L, %L, %L)', pg_temp.spec(), pg_temp.sha('a'), 'green'), '42501', 'a member wrote a verdict');
  perform pg_temp.refused(format('select public.business_law_judge_input(%L)', pg_temp.dossier()), '42501', 'a member read the judge''s input');
  perform pg_temp.refused(format($i$insert into public.business_law_verdicts (workspace_id, dossier_id, dossier_version_id, law_home, pack_sha, state, reason, laws, domains, findings)
    values (%L, %L, %L, 'blv/plan', %L, 'green', 'x', '[]', '[]', '[]')$i$, '00000000-0000-4000-8000-000002632000', pg_temp.dossier(), pg_temp.spec(), pg_temp.sha('a')),
    '42501', 'a member wrote the table');
  if pg_temp.verdicts() <> 0 then raise exception 'FAIL: a refusal wrote a verdict'; end if;
  -- Nothing judged yet: the member reads where it stands, and no verdict.
  if public.business_law_verdict_of(pg_temp.dossier()) <> jsonb_build_object(
       'dossier', pg_temp.dossier(), 'specVersion', pg_temp.spec(), 'lawHome', 'blv/plan', 'packSha', pg_temp.sha('a'), 'verdict', null) then
    raise exception 'FAIL: before a verdict, the member read %', public.business_law_verdict_of(pg_temp.dossier());
  end if;
end $$;
reset role;

-- ── The judge keeps a red; malformed verdicts are refused ──
set local role service_role;
do $$
declare
  kept jsonb;
begin
  perform pg_temp.refused(format('select pg_temp.put(%L, %L, %L)', pg_temp.spec(), pg_temp.sha('a'), 'red'), '22023', 'a red with no finding', 'State');
  perform pg_temp.refused(format('select pg_temp.put(%L, %L, %L, pg_temp.finding())', pg_temp.spec(), pg_temp.sha('a'), 'green'), '22023', 'a green with a finding', 'State');
  perform pg_temp.refused(format('select pg_temp.put(%L, %L, %L)', pg_temp.spec(), 'abc', 'green'), '22023', 'a sha out of shape', 'Pack sha');
  perform pg_temp.refused(format('select pg_temp.put(%L, %L, %L)', pg_temp.spec(), pg_temp.sha('9'), 'green'), 'P0002', 'a pack nobody kept', 'Pack sha');
  perform pg_temp.refused(format('select pg_temp.put(%L, %L, %L)', gen_random_uuid(), pg_temp.sha('a'), 'green'), 'P0002', 'no spec version', 'Version');
  perform pg_temp.refused(format('select pg_temp.put(%L, %L, %L)', pg_temp.spec(), pg_temp.sha('a'), 'amber'), '22023', 'a state out of the three', 'State');
  perform pg_temp.refused(format($i$select public.business_law_verdict_put(%L, %L, 'red', 'judged', '["BL-PRODUCT-1"]', '[]', pg_temp.finding())$i$, pg_temp.spec(), pg_temp.sha('a')),
    '22023', 'a finding on a law not judged', 'Findings');
  perform pg_temp.refused(format($i$select public.business_law_verdict_put(%L, %L, 'green', 'judged', '["quotes-1"]', '[]', '[]')$i$, pg_temp.spec(), pg_temp.sha('a')),
    '22023', 'a law id out of shape', 'Laws');
  if pg_temp.verdicts() <> 0 then raise exception 'FAIL: a refused verdict was written'; end if;

  kept := pg_temp.put(pg_temp.spec(), pg_temp.sha('a'), 'red', pg_temp.finding());
  if kept ->> 'state' <> 'red' or kept -> 'findings' <> pg_temp.finding() or kept ->> 'lawHome' <> 'blv/plan' then
    raise exception 'FAIL: a red verdict was kept as %', kept;
  end if;
  -- The same spec and pack again: the first verdict stands, and is answered.
  kept := pg_temp.put(pg_temp.spec(), pg_temp.sha('a'), 'green');
  if kept ->> 'state' <> 'red' or pg_temp.verdicts() <> 1 then
    raise exception 'FAIL: a second verdict on the same spec and pack rewrote it: %', kept;
  end if;
  if public.business_law_judge_input(pg_temp.dossier()) -> 'verdict' ->> 'state' <> 'red' then
    raise exception 'FAIL: the judge did not read the verdict kept';
  end if;
end $$;
reset role;

-- ── Carl, of another workspace, reads nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320c1');
do $$
begin
  if exists (select 1 from public.business_law_verdicts) then raise exception 'FAIL: a stranger read a verdict'; end if;
  if public.business_law_verdict_of(pg_temp.dossier()) is not null then raise exception 'FAIL: a stranger read a verdict through the function'; end if;
end $$;

-- ── Ada reads the red, and cannot approve past it ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
do $$
begin
  if (select count(*) from public.business_law_verdicts) <> 1 then raise exception 'FAIL: a member did not read the verdict'; end if;
  if public.business_law_verdict_of(pg_temp.dossier()) -> 'verdict' ->> 'state' <> 'red' then
    raise exception 'FAIL: the member read %', public.business_law_verdict_of(pg_temp.dossier());
  end if;
  perform pg_temp.refused(format('select public.dossier_approve(%L)', pg_temp.dossier()), '22023', 'a red at the newest pack was approved', 'BL-QUOTES-1');
  if exists (select 1 from public.approvals) then raise exception 'FAIL: a refused approval was written'; end if;
  -- Nobody changes or deletes a verdict, through the API.
  perform pg_temp.refused('update public.business_law_verdicts set state = ''green''', '42501', 'a member updated a verdict');
  perform pg_temp.refused('delete from public.business_law_verdicts', '42501', 'a member deleted a verdict');
end $$;
reset role;

-- ── Not even the owner of the table changes or deletes one ──
do $$
begin
  perform pg_temp.refused('update public.business_law_verdicts set state = ''green''', '42501', 'the table owner updated a verdict');
  perform pg_temp.refused('delete from public.business_law_verdicts', '42501', 'the table owner deleted a verdict');
end $$;

-- ── An older commit's pack arriving late is no newer law: the red still holds ──
set local role service_role;
select pg_temp.pack('0', '2026-11-01 09:00+00');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
select pg_temp.refused(format('select public.dossier_approve(%L)', pg_temp.dossier()), '22023', 'a late older pack lifted the red', 'BL-QUOTES-1');
reset role;

-- ── The law's amendment merges (a newer pack): the red is at an older pack, and approves ──
set local role service_role;
select pg_temp.pack('b', '2026-12-02 09:00+00');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
do $$
begin
  if public.business_law_verdict_of(pg_temp.dossier()) -> 'verdict' <> 'null'::jsonb then
    raise exception 'FAIL: a newer pack still read the older verdict';
  end if;
  perform public.dossier_approve(pg_temp.dossier());
  if (select count(*) from public.approvals) <> 1 then raise exception 'FAIL: a red at an older pack held the approval'; end if;
  -- The spec is pushed again: a new version, judged anew.
  perform public.dossier_push('blv/app', 9, 'Quote templates', null, jsonb_build_array(
    jsonb_build_object('kind', 'spec', 'content', E'---\nprd: 9\nphase0: server\n---\n\n## Solution\n\nA template is sent once its total is above zero.\n')));
end $$;
reset role;

-- ── A green, then a neutral, approve; the neutral stays the approved version's verdict ──
set local role service_role;
select pg_temp.put(pg_temp.spec(), pg_temp.sha('b'), 'green');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
do $$
begin
  perform public.dossier_approve(pg_temp.dossier());
  perform public.dossier_push('blv/app', 9, 'Quote templates', null, jsonb_build_array(
    jsonb_build_object('kind', 'spec', 'content', E'---\nprd: 9\nphase0: server\n---\n\n## Solution\n\nA footer on every quote.\n')));
end $$;
reset role;
set local role service_role;
select pg_temp.put(pg_temp.spec(), pg_temp.sha('b'), 'neutral');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
do $$
declare
  approved uuid;
begin
  perform public.dossier_approve(pg_temp.dossier());
  if (select count(*) from public.approvals) <> 3 then raise exception 'FAIL: a green or a neutral held the approval'; end if;
  select (f ->> 'version_id')::uuid into approved
    from public.approvals a cross join lateral jsonb_array_elements(a.files) f
   where f ->> 'kind' = 'spec' order by a.approved_at desc, a.id desc limit 1;
  if public.business_law_verdict_of(pg_temp.dossier(), approved) -> 'verdict' ->> 'reason' <> 'no model key on this deployment' then
    raise exception 'FAIL: the approved version''s verdict read %', public.business_law_verdict_of(pg_temp.dossier(), approved);
  end if;
  if public.business_law_verdict_of(pg_temp.dossier(), gen_random_uuid()) is not null then
    raise exception 'FAIL: a version of no spec of the dossier read a verdict';
  end if;
end $$;
reset role;

-- ── A product with no law home: a red judges nothing, and approves ──
-- A red on a fourth spec at pack b, then the product loses its plan repository: two repositories, no home.
select public.dossier_add_version(pg_temp.dossier(), 'spec', E'---\nprd: 9\nphase0: server\n---\n\nZero totals.\n', 'kit');
set local role service_role;
select pg_temp.put(pg_temp.spec(), pg_temp.sha('b'), 'red', pg_temp.finding());
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
select pg_temp.refused(format('select public.dossier_approve(%L)', pg_temp.dossier()), '22023', 'a red on the latest spec was approved', 'BL-QUOTES-1');
reset role;
update public.products set plan_repository = null where workspace_id = '00000000-0000-4000-8000-000002632000';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000026320a1');
do $$
begin
  if public.business_law_verdict_of(pg_temp.dossier()) ->> 'lawHome' is not null then raise exception 'FAIL: a product of two repositories kept a law home'; end if;
  perform public.dossier_approve(pg_temp.dossier());
  if (select count(*) from public.approvals) <> 4 then raise exception 'FAIL: a product with no law home held the approval'; end if;
end $$;
reset role;
set local role service_role;
select pg_temp.refused(format('select pg_temp.put(%L, %L, %L)', pg_temp.spec(), pg_temp.sha('b'), 'green'), '22023', 'a verdict with no law home', 'Law home');
reset role;

select 'business law verdict checks passed' as result;
rollback;
