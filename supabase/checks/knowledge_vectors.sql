-- A product's MCP finds knowledge by meaning: who reads and writes the vectors (PRD 2728 s2,
-- 20270118090000_knowledge_vectors.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/knowledge_vectors.sql
-- Nobody signed in, and anon, reads or writes public.knowledge_vectors or calls any of its four functions;
-- the service role does. knowledge_vectors_put() keeps a workspace's vectors, adds only new ones and refuses
-- a malformed call whole (a vector not 384 long, a bad hash), before anything is written.
-- knowledge_vectors_missing() names only the absent hashes; knowledge_nearest() orders the given hashes by
-- cosine distance, nearest first, keeps to them and to the workspace given (BR-PRODUCT-63), and moves
-- last_used_at at most once a day; knowledge_vectors_forget() deletes only the vectors unused for 90 days
-- (L-GDPR-4). One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Two workspaces, Lantern and Harbor, each holding knowledge; Lia is Lantern's owner.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000027280a1', 'lia@lantern.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002728100', 'lantern-vectors', 'Lantern', 'lantern-vectors'),
  ('00000000-0000-4000-8000-000002728200', 'harbor-vectors', 'Harbor', 'harbor-vectors');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002728100', '00000000-0000-4000-8000-0000027280a1', 'owner')
on conflict (workspace_id, user_id) do nothing;

-- The hash of a fictional text, as the job and the search make it.
create function pg_temp.sha(t text) returns text language sql immutable as $$
  select encode(sha256(convert_to(t, 'UTF8')), 'hex');
$$;
-- A 384-long vector whose first two numbers are a and b, the rest 0, as JSON.
create function pg_temp.vec(a float8, b float8) returns jsonb language sql immutable as $$
  select jsonb_agg(case g when 1 then a when 2 then b else 0 end order by g) from generate_series(1, 384) g;
$$;
-- A row of knowledge_vectors_put().
create function pg_temp.row_of(t text, a float8, b float8) returns jsonb language sql immutable as $$
  select jsonb_build_object('sha256', pg_temp.sha(t), 'vector', pg_temp.vec(a, b));
$$;
create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
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
grant execute on function pg_temp.sha(text) to anon, authenticated, service_role;
grant execute on function pg_temp.vec(float8, float8) to anon, authenticated, service_role;
grant execute on function pg_temp.row_of(text, float8, float8) to anon, authenticated, service_role;
grant execute on function pg_temp.refused(text, text, text) to anon, authenticated, service_role;

-- ── Who may call what ──
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.knowledge_vectors_put(uuid, text, jsonb)',
    'public.knowledge_vectors_missing(uuid, text, text[])',
    'public.knowledge_nearest(uuid, text, text[], extensions.vector, integer)',
    'public.knowledge_vectors_forget()'] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL: % is callable by someone not the service role', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'FAIL: the service role cannot call %', fn;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.knowledge_vectors', 'select, insert, update, delete')
     or has_table_privilege('authenticated', 'public.knowledge_vectors', 'select, insert, update, delete') then
    raise exception 'FAIL: someone not the service role reads or writes knowledge_vectors';
  end if;
  if not has_table_privilege('service_role', 'public.knowledge_vectors', 'select')
     or has_table_privilege('service_role', 'public.knowledge_vectors', 'insert, update, delete') then
    raise exception 'FAIL: the service role does not read knowledge_vectors, or writes it without the function';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.knowledge_vectors'::regclass) then
    raise exception 'FAIL: knowledge_vectors has no row-level security';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'knowledge_vectors') then
    raise exception 'FAIL: knowledge_vectors has a policy';
  end if;
  if not exists (select 1 from cron.job where jobname = 'knowledge-vectors-forget'
                  and command = 'select public.knowledge_vectors_forget()') then
    raise exception 'FAIL: nothing runs knowledge_vectors_forget() every day';
  end if;
end $$;

-- ── Nobody signed in, and anon, gets in ──
set local role anon;
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  jsonb_build_array(pg_temp.row_of('anon', 1, 0)))$q$, '42501', 'anon writing a vector');
select pg_temp.refused($q$select * from public.knowledge_vectors$q$, '42501', 'anon reading the vectors');
select pg_temp.refused($q$select public.knowledge_vectors_missing('00000000-0000-4000-8000-000002728100', 'gte-small', '{}')$q$,
  '42501', 'anon asking what is missing');
select pg_temp.refused($q$select * from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small', '{}',
  (pg_temp.vec(1, 0))::text::extensions.vector, 5)$q$, '42501', 'anon searching');
select pg_temp.refused($q$select public.knowledge_vectors_forget()$q$, '42501', 'anon forgetting');
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000027280a1');
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  jsonb_build_array(pg_temp.row_of('lia', 1, 0)))$q$, '42501', 'a workspace owner writing a vector');
select pg_temp.refused($q$select * from public.knowledge_vectors$q$, '42501', 'a workspace owner reading the vectors');
select pg_temp.refused($q$insert into public.knowledge_vectors (workspace_id, model, text_sha256, embedding)
  values ('00000000-0000-4000-8000-000002728100', 'gte-small', pg_temp.sha('lia'), (pg_temp.vec(1, 0))::text::extensions.vector)$q$,
  '42501', 'a workspace owner inserting a vector');
select pg_temp.refused($q$select public.knowledge_vectors_missing('00000000-0000-4000-8000-000002728100', 'gte-small', '{}')$q$,
  '42501', 'a workspace owner asking what is missing');
select pg_temp.refused($q$select * from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small', '{}',
  (pg_temp.vec(1, 0))::text::extensions.vector, 5)$q$, '42501', 'a workspace owner searching');
select pg_temp.refused($q$select public.knowledge_vectors_forget()$q$, '42501', 'a workspace owner forgetting');
reset role;

-- ── The service role keeps vectors ──
set local role service_role;
do $$
declare
  n integer;
begin
  -- Lantern: four texts at known angles from (1, 0): quote 0°, invoice ~27°, glossary 45°, ledger 90°.
  n := public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small', jsonb_build_array(
    pg_temp.row_of('quote', 1, 0), pg_temp.row_of('invoice', 2, 1), pg_temp.row_of('glossary', 1, 1),
    pg_temp.row_of('ledger', 0, 1)));
  if n <> 4 then raise exception 'FAIL: four new vectors answered %, not 4', n; end if;
  -- Harbor holds a vector of the very same text "quote", and one nearer to every query than Lantern's.
  n := public.knowledge_vectors_put('00000000-0000-4000-8000-000002728200', 'gte-small', jsonb_build_array(
    pg_temp.row_of('quote', 1, 0), pg_temp.row_of('harbor-secret', 1, 0)));
  if n <> 2 then raise exception 'FAIL: Harbor''s two new vectors answered %, not 2', n; end if;
  -- The same text again, and twice in one call, adds nothing.
  n := public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small', jsonb_build_array(
    pg_temp.row_of('quote', 1, 0), pg_temp.row_of('quote', 1, 0)));
  if n <> 0 then raise exception 'FAIL: a vector kept already counted as new (%)', n; end if;
  if (select count(*) from public.knowledge_vectors where workspace_id = '00000000-0000-4000-8000-000002728100') <> 4 then
    raise exception 'FAIL: Lantern does not hold exactly its four vectors';
  end if;
  -- An empty call keeps nothing and answers 0.
  if public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small', '[]') <> 0 then
    raise exception 'FAIL: an empty call answered something';
  end if;
end $$;

-- ── A malformed call is refused whole ──
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  jsonb_build_array(pg_temp.row_of('fine', 1, 0),
    jsonb_build_object('sha256', pg_temp.sha('short'), 'vector', '[1, 0, 0]'::jsonb)))$q$,
  '22023', 'a vector 3 long');
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  jsonb_build_array(pg_temp.row_of('fine', 1, 0),
    jsonb_build_object('sha256', pg_temp.sha('long'), 'vector', pg_temp.vec(1, 0) || '[0]'::jsonb)))$q$,
  '22023', 'a vector 385 long');
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  jsonb_build_array(jsonb_build_object('sha256', pg_temp.sha('words'),
    'vector', jsonb_set(pg_temp.vec(1, 0), '{5}', '"five"'))))$q$,
  '22023', 'a vector holding a word');
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  jsonb_build_array(pg_temp.row_of('fine', 1, 0), jsonb_build_object('sha256', 'NOT-A-HASH', 'vector', pg_temp.vec(1, 0))))$q$,
  '22023', 'a bad hash');
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  '{"sha256": "x"}'::jsonb)$q$, '22023', 'rows that are no array');
select pg_temp.refused($q$select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'Not A Model',
  jsonb_build_array(pg_temp.row_of('fine', 1, 0)))$q$, '22023', 'a bad model name');
do $$
begin
  if exists (select 1 from public.knowledge_vectors where text_sha256 = pg_temp.sha('fine')) then
    raise exception 'FAIL: a refused call wrote its good rows';
  end if;
end $$;

-- ── What is missing ──
do $$
declare
  got text[];
begin
  got := public.knowledge_vectors_missing('00000000-0000-4000-8000-000002728100', 'gte-small',
    array[pg_temp.sha('new-b'), pg_temp.sha('quote'), pg_temp.sha('new-a'), pg_temp.sha('ledger'), pg_temp.sha('new-b')]);
  if got is distinct from array[pg_temp.sha('new-b'), pg_temp.sha('new-a')] then
    raise exception 'FAIL: missing answered %, not the two absent hashes in order', got;
  end if;
  -- Harbor holds "harbor-secret", Lantern does not: it is missing for Lantern.
  got := public.knowledge_vectors_missing('00000000-0000-4000-8000-000002728100', 'gte-small',
    array[pg_temp.sha('harbor-secret')]);
  if got is distinct from array[pg_temp.sha('harbor-secret')] then
    raise exception 'FAIL: another workspace''s vector counted as Lantern''s';
  end if;
  -- Another model holds nothing yet.
  got := public.knowledge_vectors_missing('00000000-0000-4000-8000-000002728100', 'other-model', array[pg_temp.sha('quote')]);
  if got is distinct from array[pg_temp.sha('quote')] then
    raise exception 'FAIL: a vector of another model counted';
  end if;
  if public.knowledge_vectors_missing('00000000-0000-4000-8000-000002728100', 'gte-small', '{}') <> '{}' then
    raise exception 'FAIL: an empty list is missing something';
  end if;
end $$;

-- ── The nearest ──
do $$
declare
  every text[] := array[pg_temp.sha('ledger'), pg_temp.sha('quote'), pg_temp.sha('glossary'), pg_temp.sha('invoice'),
                        pg_temp.sha('harbor-secret'), pg_temp.sha('nothing-yet')];
  got   text[];
  d     double precision[];
begin
  select array_agg(n.text_sha256 order by o), array_agg(n.distance order by o) into got, d
    from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small', every,
                                  (pg_temp.vec(1, 0))::text::extensions.vector, 10) with ordinality as n (text_sha256, distance, o);
  if got is distinct from array[pg_temp.sha('quote'), pg_temp.sha('invoice'), pg_temp.sha('glossary'), pg_temp.sha('ledger')] then
    raise exception 'FAIL: nearest answered %, not quote, invoice, glossary, ledger (Lantern''s only)', got;
  end if;
  if abs(d[1]) > 1e-6 or abs(d[4] - 1) > 1e-6 or not (d[1] < d[2] and d[2] < d[3] and d[3] < d[4]) then
    raise exception 'FAIL: the distances % are not cosine distances, nearest first', d;
  end if;
  -- Only the hashes given: the nearest of all is left out when not asked for.
  select array_agg(n.text_sha256 order by o) into got
    from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small',
                                  array[pg_temp.sha('ledger'), pg_temp.sha('glossary')],
                                  (pg_temp.vec(1, 0))::text::extensions.vector, 10) with ordinality as n (text_sha256, distance, o);
  if got is distinct from array[pg_temp.sha('glossary'), pg_temp.sha('ledger')] then
    raise exception 'FAIL: nearest strayed outside the hashes given: %', got;
  end if;
  -- k bounds the answer.
  select array_agg(n.text_sha256 order by o) into got
    from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small', every,
                                  (pg_temp.vec(0, 1))::text::extensions.vector, 2) with ordinality as n (text_sha256, distance, o);
  if got is distinct from array[pg_temp.sha('ledger'), pg_temp.sha('glossary')] then
    raise exception 'FAIL: the 2 nearest to (0, 1) are %, not ledger then glossary', got;
  end if;
  -- Harbor reads only its own: never Lantern's ledger, though asked for it.
  select array_agg(n.text_sha256 order by o) into got
    from public.knowledge_nearest('00000000-0000-4000-8000-000002728200', 'gte-small', every,
                                  (pg_temp.vec(0, 1))::text::extensions.vector, 10) with ordinality as n (text_sha256, distance, o);
  if got is distinct from array[pg_temp.sha('quote'), pg_temp.sha('harbor-secret')]
     and got is distinct from array[pg_temp.sha('harbor-secret'), pg_temp.sha('quote')] then
    raise exception 'FAIL: Harbor''s search answered %, not its own two vectors', got;
  end if;
end $$;
select pg_temp.refused($q$select * from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small', '{}',
  '[1, 0, 0]'::extensions.vector, 5)$q$, '22023', 'a query 3 long');
select pg_temp.refused($q$select * from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small', '{}',
  (pg_temp.vec(1, 0))::text::extensions.vector, 0)$q$, '22023', 'k of 0');
reset role;

-- ── last_used_at moves at most once a day ──
-- Age the vectors: quote and ledger 2 days (Harbor's quote too), glossary 10 hours.
update public.knowledge_vectors set last_used_at = now() - interval '2 days'
 where text_sha256 in (pg_temp.sha('quote'), pg_temp.sha('ledger'));
update public.knowledge_vectors set last_used_at = now() - interval '10 hours'
 where text_sha256 = pg_temp.sha('glossary');
set local role service_role;
select count(*) from public.knowledge_nearest('00000000-0000-4000-8000-000002728100', 'gte-small',
  array[pg_temp.sha('quote'), pg_temp.sha('glossary')], (pg_temp.vec(1, 0))::text::extensions.vector, 10);
reset role;
do $$
begin
  if (select last_used_at from public.knowledge_vectors
       where workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('quote')) < now() - interval '1 minute' then
    raise exception 'FAIL: a vector found by a search, unused for 2 days, kept its old last_used_at';
  end if;
  if (select last_used_at from public.knowledge_vectors
       where workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('glossary')) > now() - interval '9 hours' then
    raise exception 'FAIL: a vector used 10 hours ago moved again the same day';
  end if;
  if (select last_used_at from public.knowledge_vectors
       where workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('ledger')) > now() - interval '1 day' then
    raise exception 'FAIL: a vector no search found moved';
  end if;
  if (select last_used_at from public.knowledge_vectors
       where workspace_id = '00000000-0000-4000-8000-000002728200' and text_sha256 = pg_temp.sha('quote')) > now() - interval '1 day' then
    raise exception 'FAIL: Lantern''s search moved Harbor''s vector of the same text';
  end if;
end $$;

-- A job keeping a vector again marks it used.
update public.knowledge_vectors set last_used_at = now() - interval '100 days'
 where workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('invoice');
set local role service_role;
select public.knowledge_vectors_put('00000000-0000-4000-8000-000002728100', 'gte-small',
  jsonb_build_array(pg_temp.row_of('invoice', 2, 1)));
reset role;
do $$
begin
  if (select last_used_at from public.knowledge_vectors
       where workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('invoice')) < now() - interval '1 minute' then
    raise exception 'FAIL: keeping a vector again did not mark it used';
  end if;
end $$;

-- ── Forget deletes only what aged out ──
-- ledger: unused for 91 days (goes); glossary: 89 days (stays); Harbor's harbor-secret: 120 days (goes).
update public.knowledge_vectors set last_used_at = now() - interval '91 days'
 where workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('ledger');
update public.knowledge_vectors set last_used_at = now() - interval '89 days'
 where workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('glossary');
update public.knowledge_vectors set last_used_at = now() - interval '120 days'
 where workspace_id = '00000000-0000-4000-8000-000002728200' and text_sha256 = pg_temp.sha('harbor-secret');
set local role service_role;
do $$
declare
  n integer;
begin
  n := public.knowledge_vectors_forget();
  if n <> 2 then raise exception 'FAIL: forget deleted %, not the two aged out', n; end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.knowledge_vectors
              where (workspace_id = '00000000-0000-4000-8000-000002728100' and text_sha256 = pg_temp.sha('ledger'))
                 or (workspace_id = '00000000-0000-4000-8000-000002728200' and text_sha256 = pg_temp.sha('harbor-secret'))) then
    raise exception 'FAIL: a vector unused for 90 days survived forget';
  end if;
  if (select count(*) from public.knowledge_vectors
       where workspace_id = '00000000-0000-4000-8000-000002728100'
         and text_sha256 in (pg_temp.sha('quote'), pg_temp.sha('invoice'), pg_temp.sha('glossary'))) <> 3
     or not exists (select 1 from public.knowledge_vectors
                     where workspace_id = '00000000-0000-4000-8000-000002728200' and text_sha256 = pg_temp.sha('quote')) then
    raise exception 'FAIL: forget deleted a vector used within 90 days';
  end if;
end $$;

-- ── A workspace's vectors go with it ──
delete from public.workspaces where id = '00000000-0000-4000-8000-000002728200';
do $$
begin
  if exists (select 1 from public.knowledge_vectors where workspace_id = '00000000-0000-4000-8000-000002728200') then
    raise exception 'FAIL: a deleted workspace''s vectors survived it';
  end if;
end $$;

select 'knowledge_vectors: every check passed' as result;

rollback;
