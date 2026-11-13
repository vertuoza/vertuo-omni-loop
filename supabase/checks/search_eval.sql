-- A product's eval set: its questions, their right answers marked Jev or person, and its runs (PRD omni-loop-8
-- s1, 20270121090000_search_eval.sql). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/search_eval.sql
-- A member of a product's workspace reads its questions, answers and runs (L-GDPR-1, BR-PRODUCT-63); a member
-- of another workspace reads none of them, and anon reads nothing. Nobody writes the tables straight: a member
-- adds or removes a question and sets a person's answer only through functions that record their login; only
-- the service role promotes a group's question, adds Jev's answers and records runs. Jev's answer never
-- overwrites a person's (Q4). A group joins the set once, even after a member removed its question. A run is
-- kept once per trigger and slot. jev_decision_names() answers `search-relevant`. A question's answers go with
-- it, and the set and the runs with their product.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Ada owns Lantern and Ben is a member of it; Cy owns Harbor. Lantern sells Lamp, Harbor sells Dock.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000008a1', 'ada@lantern.test'),
  ('00000000-0000-4000-8000-0000000008b1', 'ben@lantern.test'),
  ('00000000-0000-4000-8000-0000000008c1', 'cy@harbor.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000000000810', 'lantern-search-eval', 'Lantern', 'lantern-search-eval'),
  ('00000000-0000-4000-8000-000000000820', 'harbor-search-eval', 'Harbor', 'harbor-search-eval');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000000000810', '00000000-0000-4000-8000-0000000008a1', 'owner'),
  ('00000000-0000-4000-8000-000000000810', '00000000-0000-4000-8000-0000000008b1', 'member'),
  ('00000000-0000-4000-8000-000000000820', '00000000-0000-4000-8000-0000000008c1', 'owner')
on conflict (workspace_id, user_id) do nothing;
insert into public.businesses (workspace_id, name) values
  ('00000000-0000-4000-8000-000000000810', 'Lantern'),
  ('00000000-0000-4000-8000-000000000820', 'Harbor');
insert into public.products (id, workspace_id, business_id, name, key)
select x.id::uuid, b.workspace_id, b.id, x.name, x.key
  from (values ('00000000-0000-4000-8000-000000000810', '00000000-0000-4000-8000-0000000008f1', 'Lamp', 'lamp'),
               ('00000000-0000-4000-8000-000000000820', '00000000-0000-4000-8000-0000000008f2', 'Dock', 'dock'))
       as x (ws, id, name, key)
  join public.businesses b on b.workspace_id = x.ws::uuid;
-- Ben's login, as every function that names a member reads it: what his answers and questions record.
select set_config('ol8.ben', public.member_login('00000000-0000-4000-8000-000000000810', '00000000-0000-4000-8000-0000000008b1'), true);

-- A 384-long vector whose first number is 1, the rest 0.
create function pg_temp.vec() returns extensions.vector language sql immutable as $$
  select ('[' || string_agg((case g when 1 then 1 else 0 end)::text, ',' order by g) || ']')::extensions.vector
    from generate_series(1, 384) g;
$$;
create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Runs a statement that must be refused with `code`.
create function pg_temp.refused(stmt text, code text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
end;
$$;
-- How many questions, answers and runs the role now in force reads.
create function pg_temp.seen() returns text language sql as $$
  select (select count(*) from public.search_eval_questions) || '/' || (select count(*) from public.search_eval_answers)
         || '/' || (select count(*) from public.search_eval_runs);
$$;
grant execute on function pg_temp.vec() to anon, authenticated, service_role;
grant execute on function pg_temp.refused(text, text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.seen() to anon, authenticated, service_role;

-- ── Who may do what ──
do $$
declare
  t text;
begin
  foreach t in array array['public.search_eval_questions', 'public.search_eval_answers', 'public.search_eval_runs'] loop
    if has_table_privilege('anon', t, 'select, insert, update, delete') then
      raise exception 'FAIL: anon reads or writes %', t;
    end if;
    if not has_table_privilege('authenticated', t, 'select')
       or has_table_privilege('authenticated', t, 'insert, update, delete')
       or has_any_column_privilege('authenticated', t, 'insert, update') then
      raise exception 'FAIL: the signed in do not only read %', t;
    end if;
    if not has_table_privilege('service_role', t, 'select')
       or has_table_privilege('service_role', t, 'insert, update, delete')
       or has_any_column_privilege('service_role', t, 'insert, update') then
      raise exception 'FAIL: the service role does not only read % (it writes through the functions)', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = t::regclass) then
      raise exception 'FAIL: % has no row-level security', t;
    end if;
  end loop;
  -- A member's functions: the signed in only.
  foreach t in array array['public.search_eval_question_add(uuid, text, text)', 'public.search_eval_question_remove(uuid)',
                           'public.search_eval_answer_set(uuid, text, boolean)'] loop
    if has_function_privilege('anon', t, 'execute') or not has_function_privilege('authenticated', t, 'execute') then
      raise exception 'FAIL: % is not the signed in''s alone', t;
    end if;
  end loop;
  -- The service role's functions.
  foreach t in array array['public.search_eval_question_promote(uuid, uuid, text)',
                           'public.search_eval_answer_jev(uuid, text, boolean, real)',
                           'public.search_eval_run_record(uuid, text, text, jsonb, jsonb)'] loop
    if has_function_privilege('anon', t, 'execute') or has_function_privilege('authenticated', t, 'execute')
       or not has_function_privilege('service_role', t, 'execute') then
      raise exception 'FAIL: % is not the service role''s alone', t;
    end if;
  end loop;
end $$;

-- ── search-relevant is a Jev decision ──
do $$
begin
  if not ('search-relevant' = any (public.jev_decision_names()))
     or not ('search-category' = any (public.jev_decision_names()))
     or cardinality(public.jev_decision_names()) <> 9 then
    raise exception 'FAIL: jev_decision_names() answers %, not the eight and search-relevant', public.jev_decision_names();
  end if;
  if exists (select 1 from public.jev_decisions d where d.decision = 'search-relevant') then
    raise exception 'FAIL: a workspace starts with search-relevant set';
  end if;
end $$;

-- ── The logged groups the promotion reads ──
set local role service_role;
insert into public.mcp_search_log (id, product_id, workspace_id, tool, query, mode, total) values
  ('00000000-0000-4000-8000-000000000851', '00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000810',
   'search_knowledge', 'can a quote be sent without a payment term', 'meaning', 3),
  ('00000000-0000-4000-8000-000000000852', '00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000810',
   'search_knowledge', 'who signs an invoice', 'meaning', 2),
  ('00000000-0000-4000-8000-000000000853', '00000000-0000-4000-8000-0000000008f2', '00000000-0000-4000-8000-000000000820',
   'search_knowledge', 'dock ledger', 'words', 0);
insert into public.mcp_search_groups (id, product_id, workspace_id, first_search_id, question, model, embedding) values
  ('00000000-0000-4000-8000-000000000861', '00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000810',
   '00000000-0000-4000-8000-000000000851', 'can a quote be sent without a payment term', 'gte-small', pg_temp.vec()),
  ('00000000-0000-4000-8000-000000000862', '00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000810',
   '00000000-0000-4000-8000-000000000852', 'who signs an invoice', 'gte-small', pg_temp.vec()),
  ('00000000-0000-4000-8000-000000000863', '00000000-0000-4000-8000-0000000008f2', '00000000-0000-4000-8000-000000000820',
   '00000000-0000-4000-8000-000000000853', 'dock ledger', 'gte-small', pg_temp.vec());

-- ── The service role promotes a group's first question, once ──
do $$
declare
  q uuid;
  again uuid;
  row public.search_eval_questions;
begin
  q := public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000861', 'quotes');
  select * into row from public.search_eval_questions where id = q;
  if row.question is distinct from 'can a quote be sent without a payment term' or row.category is distinct from 'quotes'
     or row.group_id is distinct from '00000000-0000-4000-8000-000000000861' or row.added_by is distinct from 'promotion'
     or row.workspace_id is distinct from '00000000-0000-4000-8000-000000000810' or row.removed_at is not null then
    raise exception 'FAIL: the promoted question reads %, not the group''s first question added by promotion', row;
  end if;
  again := public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000861', 'quotes');
  if again is not null or (select count(*) from public.search_eval_questions) <> 1 then
    raise exception 'FAIL: a group promoted twice joined the set twice';
  end if;
  perform public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000862', 'invoices');
  perform public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f2', '00000000-0000-4000-8000-000000000863', 'other');
  -- The quote question's id, for the steps below that cannot read it as who they run as.
  perform set_config('ol8.q', q::text, true);
end $$;
-- A group of another product, no such group, a bad category: refused.
select pg_temp.refused($q$select public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1',
  '00000000-0000-4000-8000-000000000863', 'other')$q$, 'P0002', 'promoting a Dock group into Lamp''s set');
select pg_temp.refused($q$select public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1',
  gen_random_uuid(), 'other')$q$, 'P0002', 'promoting no such group');
select pg_temp.refused(format($q$select public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1',
  '00000000-0000-4000-8000-000000000862', %L)$q$, repeat('c', 81)), '22023', 'a category of 81 characters');
-- Nobody writes the tables straight, the service role included.
select pg_temp.refused($q$insert into public.search_eval_questions (product_id, workspace_id, question, added_by)
  values ('00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000810', 'x', 'promotion')$q$,
  '42501', 'the service role inserting a question');
select pg_temp.refused($q$update public.search_eval_questions set question = 'rewritten'$q$, '42501', 'the service role rewriting a question');
select pg_temp.refused($q$delete from public.search_eval_questions$q$, '42501', 'the service role deleting questions');
reset role;

-- ── Jev's answers: the service role's alone ──
set local role service_role;
do $$
declare
  q uuid := (select id from public.search_eval_questions where group_id = '00000000-0000-4000-8000-000000000861');
  a public.search_eval_answers;
begin
  if not public.search_eval_answer_jev(q, 'BR-QUOTES-1', true, 0.82) then
    raise exception 'FAIL: Jev''s first answer was not written';
  end if;
  if not public.search_eval_answer_jev(q, 'BR-QUOTES-2', true, 0.71) then
    raise exception 'FAIL: Jev''s second answer was not written';
  end if;
  if not public.search_eval_answer_jev(q, 'GL-TERM', false, 0.2) then
    raise exception 'FAIL: Jev''s third answer was not written';
  end if;
  -- A later judgement of Jev replaces Jev's own.
  if not public.search_eval_answer_jev(q, 'GL-TERM', false, 0.3) then
    raise exception 'FAIL: Jev''s later judgement of its own answer was not written';
  end if;
  select * into a from public.search_eval_answers where question_id = q and entry_id = 'GL-TERM';
  if a.source is distinct from 'jev' or a.decided_by is not null or abs(a.confidence - 0.3) > 1e-6 or a.relevant then
    raise exception 'FAIL: Jev''s answer reads %, not jev, no login, 0.3, not relevant', a;
  end if;
end $$;
select pg_temp.refused($q$select public.search_eval_answer_jev((select id from public.search_eval_questions limit 1), 'X', true, 1.5)$q$,
  '22023', 'a confidence above 1');
select pg_temp.refused($q$select public.search_eval_answer_jev((select id from public.search_eval_questions limit 1), '', true, 0.5)$q$,
  '22023', 'an empty entry id');
select pg_temp.refused($q$select public.search_eval_answer_jev(gen_random_uuid(), 'X', true, 0.5)$q$,
  'P0002', 'an answer to no such question');
select pg_temp.refused($q$insert into public.search_eval_answers (question_id, workspace_id, entry_id, relevant, source)
  select id, workspace_id, 'X', true, 'person' from public.search_eval_questions limit 1$q$,
  '42501', 'the service role inserting an answer straight');
select pg_temp.refused($q$select public.search_eval_answer_set((select id from public.search_eval_questions limit 1), 'X', true)$q$,
  '42501', 'the service role setting a person''s answer');
select pg_temp.refused($q$select public.search_eval_question_add('00000000-0000-4000-8000-0000000008f1', 'x', null)$q$,
  '42501', 'the service role adding a question as a member');
reset role;

-- ── A member corrects the set, as themselves ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000008b1');
do $$
declare
  q uuid := (select id from public.search_eval_questions where group_id = '00000000-0000-4000-8000-000000000861');
  mine uuid;
  a public.search_eval_answers;
begin
  -- Ben removes a right answer Jev gave, and adds one Jev missed.
  a := public.search_eval_answer_set(q, 'BR-QUOTES-2', false);
  if a.source is distinct from 'person' or a.decided_by is distinct from current_setting('ol8.ben') or a.relevant
     or a.confidence is not null then
    raise exception 'FAIL: Ben''s answer reads %, not a person''s, by Ben''s login, not relevant', a;
  end if;
  perform public.search_eval_answer_set(q, 'ADR-0067', true);
  -- He adds a question of his own, then removes the invoice question.
  mine := public.search_eval_question_add('00000000-0000-4000-8000-0000000008f1', '  how is a lamp shipped  ', 'shipping');
  if (select row(question, category, added_by, group_id) from public.search_eval_questions where id = mine)
     is distinct from row('how is a lamp shipped'::text, 'shipping'::text, current_setting('ol8.ben'), null::uuid) then
    raise exception 'FAIL: Ben''s question reads %, not his trimmed question, added by Ben''s login',
      (select row(question, category, added_by, group_id) from public.search_eval_questions where id = mine);
  end if;
  if not public.search_eval_question_remove((select id from public.search_eval_questions where group_id = '00000000-0000-4000-8000-000000000862')) then
    raise exception 'FAIL: Ben could not remove the invoice question';
  end if;
  if public.search_eval_question_remove((select id from public.search_eval_questions where group_id = '00000000-0000-4000-8000-000000000862')) then
    raise exception 'FAIL: a question removed twice answers removed twice';
  end if;
  if (select row(removed_by, removed_at is not null) from public.search_eval_questions
       where group_id = '00000000-0000-4000-8000-000000000862') is distinct from row(current_setting('ol8.ben'), true) then
    raise exception 'FAIL: the removed question does not record Ben''s login and when';
  end if;
  -- Ben reads Lamp's three questions and its four answers; nothing of Dock.
  if pg_temp.seen() <> '3/4/0' then
    raise exception 'FAIL: Ben reads % questions/answers/runs, not 3/4/0', pg_temp.seen();
  end if;
end $$;
-- Bad input, a removed question, another workspace's question or product: refused.
select pg_temp.refused($q$select public.search_eval_question_add('00000000-0000-4000-8000-0000000008f1', '   ', null)$q$,
  '22023', 'an empty question');
select pg_temp.refused(format($q$select public.search_eval_question_add('00000000-0000-4000-8000-0000000008f1', %L, null)$q$,
  repeat('q', 301)), '22023', 'a question of 301 characters');
select pg_temp.refused($q$select public.search_eval_answer_set((select id from public.search_eval_questions
  where group_id = '00000000-0000-4000-8000-000000000862'), 'X', true)$q$, 'P0002', 'an answer to a removed question');
select pg_temp.refused($q$select public.search_eval_answer_set((select id from public.search_eval_questions
  where group_id = '00000000-0000-4000-8000-000000000861'), 'X', null)$q$, '22023', 'an answer neither yes nor no');
select pg_temp.refused($q$select public.search_eval_question_add('00000000-0000-4000-8000-0000000008f2', 'x', null)$q$,
  '42501', 'Ben adding a question to Dock');
select pg_temp.refused($q$select public.search_eval_question_add(gen_random_uuid(), 'x', null)$q$,
  'P0002', 'a question of no such product');
-- No member writes the tables straight, nor calls the service role's functions.
select pg_temp.refused($q$update public.search_eval_answers set relevant = true$q$, '42501', 'a member updating answers straight');
select pg_temp.refused($q$delete from public.search_eval_questions$q$, '42501', 'a member deleting questions straight');
select pg_temp.refused($q$select public.search_eval_answer_jev((select id from public.search_eval_questions limit 1), 'X', true, 0.9)$q$,
  '42501', 'a member adding Jev''s answer');
select pg_temp.refused($q$select public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'daily', '2027-01-21', '{}', '[]')$q$,
  '42501', 'a member recording a run');
select pg_temp.refused($q$select public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1',
  '00000000-0000-4000-8000-000000000862', 'x')$q$, '42501', 'a member promoting a group');
-- Cy, of Harbor, reads Dock's one question alone, and may not touch Lamp's set.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000008c1');
do $$
begin
  if pg_temp.seen() <> '1/0/0' or (select question from public.search_eval_questions) is distinct from 'dock ledger' then
    raise exception 'FAIL: Cy reads %, not Dock''s one question alone', pg_temp.seen();
  end if;
end $$;
select pg_temp.refused($q$select public.search_eval_answer_set('00000000-0000-4000-8000-000000000000'::uuid, 'X', true)$q$,
  'P0002', 'an answer to no such question');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000008c1');
select pg_temp.refused($q$select public.search_eval_answer_set(current_setting('ol8.q')::uuid, 'X', true)$q$,
  '42501', 'Cy setting an answer of Lamp''s set');
select pg_temp.refused($q$select public.search_eval_question_remove(current_setting('ol8.q')::uuid)$q$,
  '42501', 'Cy removing a question of Lamp''s set');
reset role;

set local role anon;
select pg_temp.refused($q$select * from public.search_eval_questions$q$, '42501', 'anon reading the questions');
select pg_temp.refused($q$select * from public.search_eval_answers$q$, '42501', 'anon reading the answers');
select pg_temp.refused($q$select * from public.search_eval_runs$q$, '42501', 'anon reading the runs');
select pg_temp.refused($q$select public.search_eval_question_add('00000000-0000-4000-8000-0000000008f1', 'x', null)$q$,
  '42501', 'anon adding a question');
reset role;

-- ── A person's word wins: Jev's later judgement never overwrites it (Q4) ──
set local role service_role;
do $$
declare
  q uuid := current_setting('ol8.q')::uuid;
  removed uuid := (select id from public.search_eval_questions where group_id = '00000000-0000-4000-8000-000000000862');
  a public.search_eval_answers;
begin
  if public.search_eval_answer_jev(q, 'BR-QUOTES-2', true, 0.95) then
    raise exception 'FAIL: Jev''s judgement answered written over Ben''s answer';
  end if;
  select * into a from public.search_eval_answers where question_id = q and entry_id = 'BR-QUOTES-2';
  if a.source is distinct from 'person' or a.decided_by is distinct from current_setting('ol8.ben') or a.relevant then
    raise exception 'FAIL: Jev overwrote Ben''s answer: %', a;
  end if;
  if public.search_eval_answer_jev(removed, 'BR-INVOICES-1', true, 0.9) then
    raise exception 'FAIL: Jev answered a removed question';
  end if;
  -- The removed question's group is never promoted again.
  if public.search_eval_question_promote('00000000-0000-4000-8000-0000000008f1', '00000000-0000-4000-8000-000000000862', 'invoices')
     is not null then
    raise exception 'FAIL: a question a member removed was promoted again';
  end if;
end $$;
reset role;
-- A person's answer replaces Jev's; another member's later word replaces the first, with its own login.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000008a1');
do $$
declare
  a public.search_eval_answers;
begin
  a := public.search_eval_answer_set(current_setting('ol8.q')::uuid, 'GL-TERM', true);
  if a.source is distinct from 'person' or a.decided_by is null or a.decided_by = current_setting('ol8.ben') or not a.relevant then
    raise exception 'FAIL: Ada''s answer over Jev''s reads %', a;
  end if;
end $$;
reset role;

-- ── Runs: the service role's, once per trigger and slot ──
set local role service_role;
do $$
declare
  r uuid;
  again uuid;
  row public.search_eval_runs;
begin
  r := public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'daily', '2027-01-21',
    '{"overall": {"top1": 0.5, "top5": 1, "recall5": 0.67, "recall10": 1, "mrr": 0.75, "questions": 2}, "categories": {}}',
    '[{"questionId": "x", "ranks": [1, 7], "first": ["BR-QUOTES-1"]}]');
  select * into row from public.search_eval_runs where id = r;
  if row.trigger is distinct from 'daily' or row.slot is distinct from '2027-01-21'
     or row.workspace_id is distinct from '00000000-0000-4000-8000-000000000810'
     or (row.measures #>> '{overall,top5}') is distinct from '1' or jsonb_array_length(row.questions) <> 1 then
    raise exception 'FAIL: the run reads %', row;
  end if;
  again := public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'daily', '2027-01-21', '{"overall": {}}', '[]');
  if again is not null or (select count(*) from public.search_eval_runs) <> 1 then
    raise exception 'FAIL: a second run of the same slot was kept';
  end if;
  if public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'embed', 'job-1', '{"overall": {}}', '[]') is null then
    raise exception 'FAIL: an embed run of its own slot was not kept';
  end if;
end $$;
select pg_temp.refused($q$select public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'hourly', 's', '{}', '[]')$q$,
  '22023', 'a run of no known trigger');
select pg_temp.refused($q$select public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'daily', 's2', '[]', '[]')$q$,
  '22023', 'measures that are not an object');
select pg_temp.refused($q$select public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'daily', 's3', '{}', '{}')$q$,
  '22023', 'misses that are not an array');
select pg_temp.refused($q$select public.search_eval_run_record('00000000-0000-4000-8000-0000000008f1', 'daily', '', '{}', '[]')$q$,
  '22023', 'an empty slot');
select pg_temp.refused($q$select public.search_eval_run_record(gen_random_uuid(), 'daily', 's', '{}', '[]')$q$,
  'P0002', 'a run of no such product');
select pg_temp.refused($q$delete from public.search_eval_runs$q$, '42501', 'the service role deleting runs');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000008b1');
do $$
begin
  if pg_temp.seen() <> '3/4/2' then
    raise exception 'FAIL: Ben reads % questions/answers/runs, not 3/4/2', pg_temp.seen();
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000008c1');
do $$
begin
  if pg_temp.seen() <> '1/0/0' then
    raise exception 'FAIL: Cy reads % of Lamp''s set and runs', pg_temp.seen();
  end if;
end $$;
reset role;

-- ── Kept: the nightly forget leaves the set alone; a forgotten group leaves its question in the set ──
update public.mcp_search_log set asked_at = now() - interval '91 days'
 where id in ('00000000-0000-4000-8000-000000000851', '00000000-0000-4000-8000-000000000852');
select public.mcp_search_log_forget();
do $$
begin
  if exists (select 1 from public.mcp_search_groups where id = '00000000-0000-4000-8000-000000000861') then
    raise exception 'FAIL: the check meant the quote group to be forgotten';
  end if;
  if (select count(*) from public.search_eval_questions where product_id = '00000000-0000-4000-8000-0000000008f1') <> 3
     or (select group_id from public.search_eval_questions where id = current_setting('ol8.q')::uuid) is not null
     or (select count(*) from public.search_eval_answers) <> 4 or (select count(*) from public.search_eval_runs) <> 2 then
    raise exception 'FAIL: forgetting the log took questions, answers or runs of the set with it';
  end if;
end $$;

-- ── A product's set, answers and runs go with it ──
delete from public.products where id = '00000000-0000-4000-8000-0000000008f1';
do $$
begin
  if exists (select 1 from public.search_eval_questions where product_id = '00000000-0000-4000-8000-0000000008f1')
     or exists (select 1 from public.search_eval_answers a
                 where a.workspace_id = '00000000-0000-4000-8000-000000000810')
     or exists (select 1 from public.search_eval_runs where product_id = '00000000-0000-4000-8000-0000000008f1') then
    raise exception 'FAIL: a deleted product''s set, answers or runs survived it';
  end if;
  if (select count(*) from public.search_eval_questions) <> 1 then
    raise exception 'FAIL: deleting Lamp took Dock''s question with it';
  end if;
end $$;

rollback;
