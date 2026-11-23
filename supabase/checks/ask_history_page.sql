-- The Done tab's history, read in the database (PRD omni-loop-23, s1). The supabase workflow runs it on
-- every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/ask_history_page.sql
-- ask_history_page(filters, before, page_size) returns one page of the answered and moved rounds the
-- caller may read, newest first, keyed on created time then id; ask_history_facets(filters) returns each
-- category's count under every filter but the category (`matched`) and under none (`total`). Both run as
-- the caller (security invoker), so row-level security decides what each person reads: a member reads
-- only their workspaces' rounds (BR-PRODUCT-29), and a session of no workspace is never read
-- (BR-PRODUCT-39). Each block names the acceptance criterion it proves (AC-<n>).
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Hist: Ada and Bob, 1,284 answered rounds. Other: Carl, two answered rounds. Small: Dan, one waiting,
-- one answered and one moved round. Eve belongs to no workspace. Every name is fictional.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000023a0a1', 'ada@history.test'),
  ('00000000-0000-4000-8000-00000023a0b1', 'bob@history.test'),
  ('00000000-0000-4000-8000-00000023a0c1', 'carl@history.test'),
  ('00000000-0000-4000-8000-00000023a0d1', 'dan@history.test'),
  ('00000000-0000-4000-8000-00000023a0e1', 'eve@history.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-00000023a100', 'history-hist', 'Hist', 'hist'),
  ('00000000-0000-4000-8000-00000023a200', 'history-other', 'Other', 'history-other'),
  ('00000000-0000-4000-8000-00000023a300', 'history-small', 'Small', 'history-small');
insert into public.workspace_members (workspace_id, user_id, joined_at) values
  ('00000000-0000-4000-8000-00000023a100', '00000000-0000-4000-8000-00000023a0a1', now()),
  ('00000000-0000-4000-8000-00000023a100', '00000000-0000-4000-8000-00000023a0b1', now()),
  ('00000000-0000-4000-8000-00000023a200', '00000000-0000-4000-8000-00000023a0c1', now()),
  ('00000000-0000-4000-8000-00000023a300', '00000000-0000-4000-8000-00000023a0d1', now());

-- Rows the app writes only through its guards and triggers (who answered, the workspace): written here
-- with the triggers off, as the history they leave. The search column is generated all the same.
set local session_replication_role = replica;
insert into public.ask_sessions (id, owner, title, repo, workspace_id) values
  ('00000000-0000-4000-8000-00000023a501', '00000000-0000-4000-8000-00000023a0a1', 'plan', 'hist/plan', '00000000-0000-4000-8000-00000023a100'),
  ('00000000-0000-4000-8000-00000023a502', '00000000-0000-4000-8000-00000023a0b1', 'app', 'hist/app', '00000000-0000-4000-8000-00000023a100'),
  ('00000000-0000-4000-8000-00000023a503', '00000000-0000-4000-8000-00000023a0c1', 'other', 'other/plan', '00000000-0000-4000-8000-00000023a200'),
  ('00000000-0000-4000-8000-00000023a504', '00000000-0000-4000-8000-00000023a0d1', 'small', 'small/plan', '00000000-0000-4000-8000-00000023a300'),
  -- No workspace: Ada's own session, and Eve's (BR-PRODUCT-39).
  ('00000000-0000-4000-8000-00000023a505', '00000000-0000-4000-8000-00000023a0a1', 'orphan', 'hist/plan', null),
  ('00000000-0000-4000-8000-00000023a506', '00000000-0000-4000-8000-00000023a0e1', 'eve', 'hist/plan', null);

-- Hist, hist/plan: 1,164 rounds asked by Ada, a minute apart, the first the newest. Round n has the
-- category n % 7 (the sixth is unsorted) and talks about billing when n is even, deploy when odd, save
-- that harness rounds always talk about deploy, so harness has no billing round. Every fifth carries
-- PRD 7 and the skill omni:plan.
insert into public.ask_rounds (session_id, questions, answers, answered_via, status, category, prd, skill, created_at, answered_at, answered_by)
select '00000000-0000-4000-8000-00000023a501',
       jsonb_build_array(jsonb_build_object('header', 'Round', 'question',
         format('Round %s about %s?', n, case when n % 7 = 4 or n % 2 = 1 then 'deploy' else 'billing' end))),
       jsonb_build_object(format('Round %s about %s?', n, case when n % 7 = 4 or n % 2 = 1 then 'deploy' else 'billing' end), 'Fine'),
       'page', 'answered',
       (array['business', 'product', 'ux-ui', 'architecture', 'harness', 'other', null])[n % 7 + 1],
       case when n % 5 = 0 then 7 end,
       case when n % 5 = 0 then 'omni:plan' end,
       timestamptz '2026-11-01 12:00+00' - make_interval(mins => n),
       timestamptz '2026-11-01 12:00+00' - make_interval(mins => n) + interval '1 minute',
       '00000000-0000-4000-8000-00000023a0a1'
  from generate_series(1, 1162) n;
-- The two oldest of hist/plan, far older than the newest thousand: only one holds every word of
-- "kubernetes upgrade", the second word in its answer.
insert into public.ask_rounds (id, session_id, questions, answers, answered_via, status, category, created_at, answered_at, answered_by) values
  ('00000000-0000-4000-8000-00000023ab01', '00000000-0000-4000-8000-00000023a501',
   '[{"header": "Cluster", "question": "Should the Kubernetes cluster move?"}]', '{"Should the Kubernetes cluster move?": "Yes, upgrade it first"}',
   'terminal', 'answered', 'architecture', '2025-01-02 10:00+00', '2025-01-02 10:05+00', '00000000-0000-4000-8000-00000023a0a1'),
  ('00000000-0000-4000-8000-00000023ab02', '00000000-0000-4000-8000-00000023a501',
   '[{"header": "Cluster", "question": "Is kubernetes needed at all?"}]', '{"Is kubernetes needed at all?": "No"}',
   'terminal', 'answered', 'architecture', '2025-01-01 10:00+00', '2025-01-01 10:05+00', '00000000-0000-4000-8000-00000023a0a1');

-- Hist, hist/app: 120 rounds asked by Bob, answered by Ada, two at each minute so ties straddle every
-- page boundary (the 50th and the 51st share a time).
insert into public.ask_rounds (session_id, questions, answers, answered_via, status, category, created_at, answered_at, answered_by)
select '00000000-0000-4000-8000-00000023a502',
       jsonb_build_array(jsonb_build_object('question', format('App round %s?', n))),
       jsonb_build_object(format('App round %s?', n), 'Done'),
       'page', 'answered', 'product',
       timestamptz '2026-11-02 12:00+00' - make_interval(mins => n / 2),
       timestamptz '2026-11-02 12:00+00' - make_interval(mins => n / 2) + interval '1 minute',
       '00000000-0000-4000-8000-00000023a0a1'
  from generate_series(1, 120) n;

-- Other: two answered rounds about billing, newer than all of Hist's.
insert into public.ask_rounds (id, session_id, questions, answers, answered_via, status, category, created_at, answered_at, answered_by) values
  ('00000000-0000-4000-8000-00000023ac01', '00000000-0000-4000-8000-00000023a503', '[{"question": "Other billing kubernetes?"}]', '{"Other billing kubernetes?": "upgrade"}', 'page', 'answered', 'business', '2026-11-20 10:00+00', '2026-11-20 10:05+00', '00000000-0000-4000-8000-00000023a0c1'),
  ('00000000-0000-4000-8000-00000023ac02', '00000000-0000-4000-8000-00000023a503', '[{"question": "Other second?"}]', '{"Other second?": "Yes"}', 'page', 'answered', null, '2026-11-20 09:00+00', '2026-11-20 09:05+00', '00000000-0000-4000-8000-00000023a0c1');

-- Small: one waiting, one answered, one moved to the terminal.
insert into public.ask_rounds (id, session_id, questions, answers, answered_via, status, created_at, answered_at, answered_by) values
  ('00000000-0000-4000-8000-00000023ad01', '00000000-0000-4000-8000-00000023a504', '[{"question": "Still waiting?"}]', null, null, 'open', '2026-11-21 10:00+00', null, null),
  ('00000000-0000-4000-8000-00000023ad02', '00000000-0000-4000-8000-00000023a504', '[{"question": "Answered?"}]', '{"Answered?": "Yes"}', 'page', 'answered', '2026-11-21 09:00+00', '2026-11-21 09:05+00', '00000000-0000-4000-8000-00000023a0d1'),
  ('00000000-0000-4000-8000-00000023ad03', '00000000-0000-4000-8000-00000023a504', '[{"question": "Moved?"}]', null, null, 'abandoned', '2026-11-21 08:00+00', null, null);

-- The sessions of no workspace: an answered round each, about billing and kubernetes.
insert into public.ask_rounds (id, session_id, questions, answers, answered_via, status, category, created_at, answered_at, answered_by) values
  ('00000000-0000-4000-8000-00000023ae01', '00000000-0000-4000-8000-00000023a505', '[{"question": "Orphan billing kubernetes?"}]', '{"Orphan billing kubernetes?": "upgrade"}', 'terminal', 'answered', 'business', '2026-11-22 10:00+00', '2026-11-22 10:05+00', '00000000-0000-4000-8000-00000023a0a1'),
  ('00000000-0000-4000-8000-00000023ae02', '00000000-0000-4000-8000-00000023a506', '[{"question": "Eve billing kubernetes?"}]', '{"Eve billing kubernetes?": "upgrade"}', 'terminal', 'answered', 'business', '2026-11-22 10:00+00', '2026-11-22 10:05+00', '00000000-0000-4000-8000-00000023a0e1');
set local session_replication_role = origin;

-- What each read should give, worked out here with the table read directly and the words matched with
-- ILIKE, never with the functions under check.
create temporary table expected (name text primary key, ids uuid[], n bigint);
insert into expected (name, ids) values
  ('app pages', array(
    select r.id from public.ask_rounds r
     where r.session_id = '00000000-0000-4000-8000-00000023a502' order by r.created_at desc, r.id desc));
insert into expected (name, n)
select 'billing in hist/plan · ' || c.category,
       (select count(*) from public.ask_rounds r
         where r.session_id = '00000000-0000-4000-8000-00000023a501'
           and coalesce(r.category, 'unsorted') = c.category
           and r.questions::text ilike '%billing%')
  from unnest(array['business', 'product', 'ux-ui', 'architecture', 'harness', 'other', 'unsorted']) c (category);
insert into expected (name, n)
select 'hist · ' || c.category,
       (select count(*) from public.ask_rounds r
          join public.ask_sessions s on s.id = r.session_id
         where s.workspace_id = '00000000-0000-4000-8000-00000023a100'
           and coalesce(r.category, 'unsorted') = c.category)
  from unnest(array['business', 'product', 'ux-ui', 'architecture', 'harness', 'other', 'unsorted']) c (category);
grant select on expected to authenticated;

-- The fixture itself: the kubernetes round is older than the newest thousand of Hist.
do $$
begin
  if (select count(*) from public.ask_rounds r join public.ask_sessions s on s.id = r.session_id
       where s.workspace_id = '00000000-0000-4000-8000-00000023a100' and r.status = 'answered') <> 1284 then
    raise exception 'FAIL: the fixture does not hold 1,284 answered rounds in Hist';
  end if;
  if (select count(*) from public.ask_rounds r join public.ask_sessions s on s.id = r.session_id
       where s.workspace_id = '00000000-0000-4000-8000-00000023a100'
         and r.created_at > (select created_at from public.ask_rounds where id = '00000000-0000-4000-8000-00000023ab01')) < 1000 then
    raise exception 'FAIL: the fixture''s kubernetes round is not older than the newest thousand';
  end if;
  if (select n from expected where name = 'billing in hist/plan · harness') <> 0
     or (select n from expected where name = 'hist · harness') = 0 then
    raise exception 'FAIL: the fixture''s harness rounds should all be about deploy';
  end if;
end $$;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── Run as the caller, by a signed-in person only ──
do $$
begin
  if exists (select 1 from pg_proc p where p.oid in ('public.ask_history_page(jsonb, uuid, integer)'::regprocedure, 'public.ask_history_facets(jsonb)'::regprocedure) and p.prosecdef) then
    raise exception 'FAIL: BR-PRODUCT-29: a history function runs as its definer, not as the caller';
  end if;
  if has_function_privilege('anon', 'public.ask_history_page(jsonb, uuid, integer)', 'execute')
     or has_function_privilege('anon', 'public.ask_history_facets(jsonb)', 'execute') then
    raise exception 'FAIL: BR-PRODUCT-29: anon may run a history function';
  end if;
  if not has_function_privilege('authenticated', 'public.ask_history_page(jsonb, uuid, integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.ask_history_facets(jsonb)', 'execute') then
    raise exception 'FAIL: a signed-in person may not run the history functions';
  end if;
end $$;

-- ── The search column is derived, never written (BR-PRODUCT-12) ──
do $$
begin
  if (select attgenerated from pg_attribute where attrelid = 'public.ask_rounds'::regclass and attname = 'search') <> 's' then
    raise exception 'FAIL: ask_rounds.search is not a stored generated column';
  end if;
  if has_column_privilege('authenticated', 'public.ask_rounds', 'search', 'insert')
     or has_column_privilege('authenticated', 'public.ask_rounds', 'search', 'update') then
    raise exception 'FAIL: a signed-in person may write ask_rounds.search';
  end if;
end $$;

set local role authenticated;

-- ── Ada, a member of Hist ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000023a0a1', 'ada@history.test');
do $$
declare
  page uuid[];
  seen uuid[] := '{}';
  sizes int[] := '{}';
  cursor_id uuid := null;
  f record;
begin
  -- AC-6: the count is the true total, past the newest thousand.
  if (select sum(total) from public.ask_history_facets('{}')) <> 1284
     or (select sum(matched) from public.ask_history_facets('{}')) <> 1284 then
    raise exception 'FAIL: AC-6: the facets do not count the 1,284 answered rounds of Hist (got %)', (select sum(total) from public.ask_history_facets('{}'));
  end if;

  -- AC-8, BR-PRODUCT-29: no round or count of Other.
  if exists (select 1 from public.ask_history_page('{}', null, 100) p
              join public.ask_sessions s on s.id = p.session_id
             where s.workspace_id <> '00000000-0000-4000-8000-00000023a100') then
    raise exception 'FAIL: AC-8: BR-PRODUCT-29: a member read a round of another workspace';
  end if;
  if exists (select 1 from public.ask_history_page('{"search": "other"}', null, 100)) then
    raise exception 'FAIL: AC-8: BR-PRODUCT-29: a search found a round of another workspace';
  end if;
  if (select sum(matched) from public.ask_history_facets('{"search": "other"}')) <> 0 then
    raise exception 'FAIL: AC-8: BR-PRODUCT-29: the facets counted a round of another workspace';
  end if;
  -- A cursor naming a round of another workspace reads nothing, rather than a page past it.
  if exists (select 1 from public.ask_history_page('{}', '00000000-0000-4000-8000-00000023ac01', 50)) then
    raise exception 'FAIL: AC-8: BR-PRODUCT-29: a cursor of another workspace''s round paged the history';
  end if;

  -- BR-PRODUCT-39: Ada's own session of no workspace, and Eve's, are never read.
  if exists (select 1 from public.ask_history_page('{"search": "orphan"}', null, 50))
     or exists (select 1 from public.ask_history_page('{"search": "eve"}', null, 50))
     or exists (select 1 from public.ask_history_page('{}', null, 100) p
                 where p.session_id in ('00000000-0000-4000-8000-00000023a505', '00000000-0000-4000-8000-00000023a506')) then
    raise exception 'FAIL: BR-PRODUCT-39: a round of a session of no workspace was read';
  end if;
  if (select sum(matched) from public.ask_history_facets('{"search": "orphan"}')) <> 0 then
    raise exception 'FAIL: BR-PRODUCT-39: the facets counted a round of a session of no workspace';
  end if;

  -- The page: newest first, keyed on created time then id.
  if array(select p.id from public.ask_history_page('{}', null, 5) p)
     <> array(select r.id from public.ask_rounds r join public.ask_sessions s on s.id = r.session_id
               where s.workspace_id = '00000000-0000-4000-8000-00000023a100'
               order by r.created_at desc, r.id desc limit 5) then
    raise exception 'FAIL: the first page is not the newest five rounds';
  end if;
  if (select count(*) from public.ask_history_page('{}', null, null)) <> 50 then
    raise exception 'FAIL: a page with no size is not 50 rounds';
  end if;
  if (select count(*) from public.ask_history_page('{}', null, 100000)) > 200 then
    raise exception 'FAIL: a page is not capped at 200 rounds';
  end if;

  -- AC-5: 120 rounds read 50, 50, then 20, newest first, none twice, none skipped, ties on the boundary.
  loop
    page := array(select p.id from public.ask_history_page('{"repo": "hist/app"}', cursor_id, 50) p);
    exit when cardinality(page) = 0;
    sizes := sizes || cardinality(page);
    seen := seen || page;
    cursor_id := page[cardinality(page)];
    if cardinality(sizes) > 5 then raise exception 'FAIL: AC-5: the pages never end'; end if;
  end loop;
  if sizes <> array[50, 50, 20] then
    raise exception 'FAIL: AC-5: 120 rounds were read in pages of % rather than 50, 50, 20', sizes;
  end if;
  if seen <> (select ids from expected where name = 'app pages') then
    raise exception 'FAIL: AC-5: the pages skipped, repeated or misordered a round';
  end if;

  -- AC-7: search runs over every round, and a round must hold every word, in its question or its answer.
  if array(select p.id from public.ask_history_page('{"search": "Kubernetes"}', null, 50) p)
     <> array['00000000-0000-4000-8000-00000023ab01', '00000000-0000-4000-8000-00000023ab02']::uuid[] then
    raise exception 'FAIL: AC-7: a search for kubernetes did not find both rounds older than the newest thousand';
  end if;
  if array(select p.id from public.ask_history_page('{"search": "kubernetes  upgrade"}', null, 50) p)
     <> array['00000000-0000-4000-8000-00000023ab01']::uuid[] then
    raise exception 'FAIL: AC-7: a search for two words did not find only the round holding both';
  end if;
  if (select sum(matched) from public.ask_history_facets('{"search": "kubernetes upgrade"}')) <> 1 then
    raise exception 'FAIL: AC-7: the facets did not count only the round holding every word';
  end if;
  if (select count(*) from public.ask_history_page('{"search": "   "}', null, 50)) <> 50 then
    raise exception 'FAIL: a blank search narrowed the history';
  end if;

  -- AC-9: each category's count follows the search and the repository, and the category filter is not
  -- one of them; a category with no match stays, with its count 0.
  for f in select * from public.ask_history_facets('{"search": "billing", "repo": "hist/plan", "category": "product"}') loop
    if f.matched <> (select n from expected where name = 'billing in hist/plan · ' || f.category) then
      raise exception 'FAIL: AC-9: % counts % under the search and the repository, expected %', f.category, f.matched,
        (select n from expected where name = 'billing in hist/plan · ' || f.category);
    end if;
    if f.total <> (select n from expected where name = 'hist · ' || f.category) then
      raise exception 'FAIL: AC-9: % counts % in all, expected %', f.category, f.total, (select n from expected where name = 'hist · ' || f.category);
    end if;
  end loop;
  if array(select x.category from public.ask_history_facets('{"search": "billing", "repo": "hist/plan"}') x)
     <> array['business', 'product', 'ux-ui', 'architecture', 'harness', 'other', 'unsorted'] then
    raise exception 'FAIL: AC-9: the facets do not list every category, unsorted last';
  end if;
  if (select matched from public.ask_history_facets('{"search": "billing", "repo": "hist/plan"}') where category = 'harness') <> 0 then
    raise exception 'FAIL: AC-9: harness, with no billing round, does not stay listed with 0';
  end if;

  -- The other filters, on the page and the facets alike.
  if exists (select 1 from public.ask_history_page('{"category": "unsorted"}', null, 200) p where p.category is not null)
     or not exists (select 1 from public.ask_history_page('{"category": "unsorted"}', null, 200)) then
    raise exception 'FAIL: the unsorted category does not read only the rounds with no category';
  end if;
  if exists (select 1 from public.ask_history_page('{"category": "architecture"}', null, 200) p where p.category <> 'architecture') then
    raise exception 'FAIL: a category reads a round of another category';
  end if;
  if (select sum(matched) from public.ask_history_facets('{"askedBy": "00000000-0000-4000-8000-00000023a0b1"}')) <> 120 then
    raise exception 'FAIL: askedBy does not narrow to the rounds of Bob''s sessions';
  end if;
  if (select sum(matched) from public.ask_history_facets('{"answeredBy": "00000000-0000-4000-8000-00000023a0b1"}')) <> 0
     or (select sum(matched) from public.ask_history_facets('{"answeredBy": "00000000-0000-4000-8000-00000023a0a1"}')) <> 1284 then
    raise exception 'FAIL: answeredBy does not narrow to the rounds that person answered';
  end if;
  if (select sum(matched) from public.ask_history_facets('{"prd": 7}')) <> 232
     or (select sum(matched) from public.ask_history_facets('{"prd": 7, "skill": "omni:plan"}')) <> 232
     or (select sum(matched) from public.ask_history_facets('{"skill": "omni:brainstorm"}')) <> 0 then
    raise exception 'FAIL: prd and skill do not narrow to the rounds that carry them';
  end if;
  if exists (select 1 from public.ask_history_page('{"prd": 7}', null, 200) p where p.prd is distinct from 7 or p.skill is distinct from 'omni:plan') then
    raise exception 'FAIL: the page under prd 7 read a round of another PRD';
  end if;
end $$;

-- ── Dan, a member of Small ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000023a0d1', 'dan@history.test');
do $$
begin
  -- AC-4: the answered and the moved rounds are listed, newest first; the waiting one is not.
  if array(select p.id from public.ask_history_page('{}', null, 50) p)
     <> array['00000000-0000-4000-8000-00000023ad02', '00000000-0000-4000-8000-00000023ad03']::uuid[] then
    raise exception 'FAIL: AC-4: Done does not list exactly the answered and the moved round';
  end if;
  if (select sum(total) from public.ask_history_facets('{}')) <> 2 then
    raise exception 'FAIL: AC-4: the facets counted the waiting round';
  end if;
end $$;

-- ── Carl, a member of Other ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000023a0c1', 'carl@history.test');
do $$
begin
  -- AC-8, BR-PRODUCT-29: Carl reads Other's two rounds and nothing of Hist.
  if array(select p.id from public.ask_history_page('{}', null, 50) p)
     <> array['00000000-0000-4000-8000-00000023ac01', '00000000-0000-4000-8000-00000023ac02']::uuid[] then
    raise exception 'FAIL: AC-8: BR-PRODUCT-29: Carl does not read exactly Other''s rounds';
  end if;
  if (select sum(total) from public.ask_history_facets('{}')) <> 2
     or (select total from public.ask_history_facets('{}') where category = 'business') <> 1
     or (select total from public.ask_history_facets('{}') where category = 'unsorted') <> 1 then
    raise exception 'FAIL: AC-8: BR-PRODUCT-29: Carl''s facets are not Other''s';
  end if;
end $$;

-- ── Eve, of no workspace ──
select pg_temp.sign_in('00000000-0000-4000-8000-00000023a0e1', 'eve@history.test');
do $$
begin
  -- BR-PRODUCT-39: her own session of no workspace is never read, and nothing else either.
  if exists (select 1 from public.ask_history_page('{}', null, 50)) then
    raise exception 'FAIL: BR-PRODUCT-39: a person of no workspace read a round';
  end if;
  if (select sum(total) from public.ask_history_facets('{}')) <> 0 then
    raise exception 'FAIL: BR-PRODUCT-39: a person of no workspace counted a round';
  end if;
end $$;

-- ── Signed out: nothing ──
reset role;
set local role anon;
do $$
begin
  begin perform 1 from public.ask_history_page('{}', null, 50); raise exception 'FAIL: anon read the history';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.ask_history_facets('{}'); raise exception 'FAIL: anon counted the history';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
