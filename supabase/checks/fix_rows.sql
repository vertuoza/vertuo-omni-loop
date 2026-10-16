-- A bug record born on the server, with its Fixes rows (PRD 2011 s5). The supabase workflow runs it on
-- every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/fix_rows.sql
-- Accounts each with its own JWT. fix_bug_push() creates the product's next bug, mobile-B1, a dossier of
-- kind bug with no repository and no issue, numbered by the product's own counter apart from its PRDs
-- and roadmaps, with its rows in order and its bug.md as a version; a later push by any member rewrites
-- the rows and adds a version only when bug.md changed. A row naming a repository outside the product
-- is refused by name and nothing is written. fix_row_stamp(), the service role's alone, stamps every row
-- of a merged pull request once, marks a close and clears it on a reopen; the last merge ships the record;
-- a merge matching no row of the record its body names is kept once as unmatched. A merged row is never
-- moved, changed or dropped. fix_facts reads its summary from the rows. A member reads their workspace's
-- rows; an account of another workspace, of none, or signed out, nothing; nobody signed in writes the
-- tables. One transaction, rolled back at the end; then two creates at once, in two sessions on rows
-- they commit and delete, take two numbers with no gap. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000020115a1', 'ada@fixrows.test'),
  ('00000000-0000-4000-8000-0000020115b1', 'bob@fixrows.test'),
  ('00000000-0000-4000-8000-0000020115c1', 'carl@fixrows.test'),
  ('00000000-0000-4000-8000-0000020115e1', 'eve@fixrows.test');
-- Ada and Bob belong to Vertuoza; Carl to Acme; Eve to none. Each workspace sells a product keyed mobile.
insert into public.workspaces (slug, name, github_org) values ('acme-fixrows', 'Acme', 'acme-fixrows');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values
         ('vertuoza',     '00000000-0000-4000-8000-0000020115a1'::uuid),
         ('vertuoza',     '00000000-0000-4000-8000-0000020115b1'::uuid),
         ('acme-fixrows', '00000000-0000-4000-8000-0000020115c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;
insert into public.businesses (workspace_id, name)
select w.id, 'Acme' from public.workspaces w
 where w.slug = 'acme-fixrows' and not exists (select 1 from public.businesses b where b.workspace_id = w.id);
insert into public.businesses (workspace_id, name)
select w.id, 'Vertuoza' from public.workspaces w
 where w.slug = 'vertuoza' and not exists (select 1 from public.businesses b where b.workspace_id = w.id);
insert into public.products (workspace_id, business_id, name, key)
select b.workspace_id, b.id, case w.slug when 'vertuoza' then 'Fix Mobile' else 'Acme Mobile' end, 'mobile'
  from public.businesses b join public.workspaces w on w.id = b.workspace_id
 where w.slug in ('vertuoza', 'acme-fixrows');
-- Fix Mobile holds vertuoza/fix-app and vertuoza/fix-api; vertuoza/fix-web is tracked but in no product.
-- Acme Mobile holds acme-fixrows/app.
insert into public.repositories (workspace_id, full_name)
select w.id, r.name
  from (values ('vertuoza', 'vertuoza/fix-app'), ('vertuoza', 'vertuoza/fix-api'), ('vertuoza', 'vertuoza/fix-web'),
               ('acme-fixrows', 'acme-fixrows/app')) as r (slug, name)
  join public.workspaces w on w.slug = r.slug;
insert into public.product_repositories (product_id, workspace_id, repository, added_by)
select p.id, p.workspace_id, r.name, 'person'
  from (values ('vertuoza', 'vertuoza/fix-app'), ('vertuoza', 'vertuoza/fix-api'), ('acme-fixrows', 'acme-fixrows/app')) as r (slug, name)
  join public.workspaces w on w.slug = r.slug
  join public.products p on p.workspace_id = w.id and p.key = 'mobile';
-- A product PRD and a product roadmap numbered 1 already: the product's bugs count apart.
insert into public.dossiers (workspace_id, kind, product_id, product_seq, title, numbered_at, birthplace)
select p.workspace_id, k.kind, p.id, 1, k.title, now(), 'server'
  from (values ('prd', 'A product PRD'), ('roadmap', 'A product roadmap')) as k (kind, title)
  join public.products p on p.key = 'mobile' and p.name = 'Fix Mobile';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

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

-- A push's body, its fields overridden by `extra`: two rows, the API's fix then the app's.
create function pg_temp.body(extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'title', 'Sign-in loops on the phone', 'record', E'---\nbug: mobile-B1\n---\n# Sign-in loops\n',
    'rows', jsonb_build_array(
      jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 41, 'changes', 'The token refresh keeps the session.',
                         'reproduction', 'session.test.ts: a refresh drops the session', 'guard', 'refresh keeps the session'),
      jsonb_build_object('repo', 'Vertuoza/Fix-App', 'pull', null, 'changes', 'The app retries once, not forever.'))
  ) || extra;
$$;

-- The ids made along the way, by name.
create temporary table made (name text primary key, id uuid);
grant select, insert on made to anon, authenticated, service_role;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
-- The rows, as one value to compare before and after a refusal.
create function pg_temp.rows_of() returns text language sql security definer as $$
  select coalesce(string_agg(row(r.*)::text, ';' order by r.dossier_id, r.position), '') from public.fix_rows r;
$$;

-- ── What the migration added, and who may write it ──
do $$
begin
  if has_table_privilege('authenticated', 'public.fix_rows', 'insert, update, delete, truncate')
     or has_table_privilege('authenticated', 'public.fix_unmatched_merges', 'insert, update, delete, truncate')
     or has_table_privilege('service_role', 'public.fix_rows', 'insert, update, delete, truncate')
     or has_table_privilege('service_role', 'public.fix_unmatched_merges', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the fix rows are written other than through fix_bug_push() and fix_row_stamp()';
  end if;
  if has_table_privilege('anon', 'public.fix_rows', 'select') or has_table_privilege('anon', 'public.fix_unmatched_merges', 'select') then
    raise exception 'FAIL: anon may read the fix rows';
  end if;
  if has_column_privilege('authenticated', 'public.products', 'bug_seq', 'update') then
    raise exception 'FAIL: a product''s bug counter is written other than through fix_bug_push()';
  end if;
  if not has_function_privilege('authenticated', 'public.fix_bug_push(text, integer, jsonb, text)', 'execute')
     or has_function_privilege('anon', 'public.fix_bug_push(text, integer, jsonb, text)', 'execute') then
    raise exception 'FAIL: fix_bug_push() is not the signed-in''s alone';
  end if;
  if has_function_privilege('authenticated', 'public.fix_row_stamp(text, integer, text, timestamptz, text)', 'execute')
     or has_function_privilege('anon', 'public.fix_row_stamp(text, integer, text, timestamptz, text)', 'execute')
     or not has_function_privilege('service_role', 'public.fix_row_stamp(text, integer, text, timestamptz, text)', 'execute') then
    raise exception 'FAIL: fix_row_stamp() is not the service role''s alone';
  end if;
end $$;

-- ── Signed out: no push ──
set local role anon;
select pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body())$q$, '42501', 'anon pushing a bug');
reset role;

-- ── Ada creates mobile-B1, its rows in order ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115a1');
do $$
declare
  ws      uuid := (select id from public.workspaces where slug = 'vertuoza');
  mobile  uuid := (select p.id from public.products p where p.name = 'Fix Mobile');
  answer  jsonb;
  dossier uuid;
begin
  answer := public.fix_bug_push('mobile', null, pg_temp.body());
  dossier := (answer ->> 'dossierId')::uuid;
  insert into made values ('mobile-B1', dossier);
  if answer ->> 'bug' <> 'mobile-B1' or (answer ->> 'created')::boolean is not true or answer -> 'product' ->> 'name' <> 'Fix Mobile'
     or answer -> 'added' <> '[{"kind": "bug-record", "version": 1}]'::jsonb or answer -> 'unchanged' <> '[]'::jsonb
     or answer -> 'rows' <> '[{"pull": 41, "state": "open", "position": 1, "repository": "vertuoza/fix-api"},
                              {"pull": null, "state": "open", "position": 2, "repository": "vertuoza/fix-app"}]'::jsonb then
    raise exception 'FAIL: a first bug push did not answer mobile-B1 with its rows and record: %', answer;
  end if;
  if not exists (select 1 from public.dossiers d
                  where d.id = dossier and d.kind = 'bug' and d.product_id = mobile and d.product_seq = 1 and d.workspace_id = ws
                    and d.home_repo is null and d.prd is null and d.birthplace = 'server' and d.numbered_at is not null
                    and d.title = 'Sign-in loops on the phone' and d.opened_by = '00000000-0000-4000-8000-0000020115a1') then
    raise exception 'FAIL: mobile-B1 is not a bug dossier of Fix Mobile, numbered 1, born on the server';
  end if;
  if (select string_agg(r.position || ' ' || r.repository || ' ' || coalesce(r.pull::text, '-') || ' ' || r.state || ' '
                        || coalesce(r.reproduction, '-') || ' ' || coalesce(r.guard, '-'), ' | ' order by r.position)
        from public.fix_rows r where r.dossier_id = dossier and r.workspace_id = ws)
     <> '1 vertuoza/fix-api 41 open session.test.ts: a refresh drops the session refresh keeps the session | 2 vertuoza/fix-app - open - -' then
    raise exception 'FAIL: mobile-B1''s rows are not stored in order, as pushed';
  end if;
  if (select count(*) from public.dossier_versions v where v.dossier_id = dossier and v.kind = 'bug-record') <> 1 then
    raise exception 'FAIL: mobile-B1''s bug.md is not its one version';
  end if;
  if (select p.bug_seq from public.products p where p.id = mobile) <> 1
     or (select p.prd_count from public.products p where p.id = mobile) <> 0 then
    raise exception 'FAIL: the bug counter moved some other counter, or did not move';
  end if;
  -- The second create takes the next number, its PRD and roadmap counters untouched.
  answer := public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('title', 'A second bug', 'record', null,
    'rows', jsonb_build_array(jsonb_build_object('repo', 'vertuoza/fix-api', 'changes', 'Not opened yet.')))));
  insert into made values ('mobile-B2', (answer ->> 'dossierId')::uuid);
  if answer ->> 'bug' <> 'mobile-B2' or answer -> 'added' <> '[]'::jsonb then
    raise exception 'FAIL: a second create did not take mobile-B2, or added a record it did not carry: %', answer;
  end if;
end $$;

-- ── A row outside the product is refused by name, and nothing is written ──
do $$
declare
  before_rows text := pg_temp.rows_of();
  before_seq  integer := (select p.bug_seq from public.products p where p.name = 'Fix Mobile');
  before_n    bigint := (select count(*) from public.dossiers where kind = 'bug');
begin
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
      jsonb_build_object('repo', 'vertuoza/fix-api', 'changes', 'fine'),
      jsonb_build_object('repo', 'vertuoza/fix-web', 'changes', 'outside'),
      jsonb_build_object('repo', 'acme-fixrows/app', 'changes', 'another workspace')))))$q$,
    '22023', 'a create naming repositories outside the product', 'Not a repository of Fix Mobile: acme-fixrows/app, vertuoza/fix-web.');
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
      jsonb_build_object('repo', 'vertuoza/fix-web', 'changes', 'outside')))))$q$,
    '22023', 'a push naming a repository outside the product', 'vertuoza/fix-web');
  if pg_temp.rows_of() <> before_rows or (select p.bug_seq from public.products p where p.name = 'Fix Mobile') <> before_seq
     or (select count(*) from public.dossiers where kind = 'bug') <> before_n then
    raise exception 'FAIL: a refused push wrote something';
  end if;
  -- Malformed pushes.
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('rows', '[]'::jsonb)))$q$, '22023', 'a bug with no rows');
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('title', ' ')))$q$, '22023', 'a bug with no title');
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
      jsonb_build_object('repo', 'vertuoza/fix-api')))))$q$, '22023', 'a row with no changes');
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
      jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', '12', 'changes', 'x')))))$q$, '22023', 'a pull request as text');
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
      jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', -3, 'changes', 'x')))))$q$, '22023', 'a negative pull request');
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
      jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 7, 'changes', 'x'),
      jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 7, 'changes', 'y')))))$q$, '22023', 'one pull request on two rows');
  perform pg_temp.refused($q$select public.fix_bug_push('Mobile', null, pg_temp.body())$q$, '22023', 'a key out of shape');
  perform pg_temp.refused($q$select public.fix_bug_push('nope', null, pg_temp.body())$q$, 'P0002', 'an unknown key');
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', 9, pg_temp.body())$q$, 'P0002', 'a bug the product does not have', 'mobile-B9');
  if pg_temp.rows_of() <> before_rows or (select p.bug_seq from public.products p where p.name = 'Fix Mobile') <> before_seq then
    raise exception 'FAIL: a malformed push wrote something';
  end if;
end $$;
reset role;

-- ── Bob, another member, pushes again: the rows follow the push, bug.md only when it changed ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115b1');
do $$
declare
  dossier uuid := pg_temp.made('mobile-B1');
  answer  jsonb;
begin
  answer := public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
    jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 41, 'changes', 'The token refresh keeps the session.',
                       'reproduction', 'session.test.ts: a refresh drops the session', 'guard', 'refresh keeps the session'),
    jsonb_build_object('repo', 'vertuoza/fix-app', 'pull', 7, 'changes', 'The app retries once, not forever.', 'guard', 'retry.test.ts'),
    jsonb_build_object('repo', 'vertuoza/fix-app', 'pull', 8, 'changes', 'The app says why it signed out.')))));
  if answer ->> 'bug' <> 'mobile-B1' or (answer ->> 'created')::boolean or answer -> 'added' <> '[]'::jsonb
     or answer -> 'unchanged' <> '["bug-record"]'::jsonb or jsonb_array_length(answer -> 'rows') <> 3 then
    raise exception 'FAIL: a second push of mobile-B1 did not keep its record and take three rows: %', answer;
  end if;
  if (select string_agg(r.position || ' ' || r.repository || '#' || coalesce(r.pull::text, '-') || ' ' || coalesce(r.guard, '-'), ' | ' order by r.position)
        from public.fix_rows r where r.dossier_id = dossier)
     <> '1 vertuoza/fix-api#41 refresh keeps the session | 2 vertuoza/fix-app#7 retry.test.ts | 3 vertuoza/fix-app#8 -' then
    raise exception 'FAIL: the rows do not follow the second push';
  end if;
  answer := public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('record', E'# Sign-in loops, found\n', 'rows', jsonb_build_array(
    jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 41, 'changes', 'The token refresh keeps the session.',
                       'reproduction', 'session.test.ts: a refresh drops the session', 'guard', 'refresh keeps the session'),
    jsonb_build_object('repo', 'vertuoza/fix-app', 'pull', 7, 'changes', 'The app retries once, not forever.', 'guard', 'retry.test.ts'),
    jsonb_build_object('repo', 'vertuoza/fix-app', 'pull', 8, 'changes', 'The app says why it signed out.')))));
  if answer -> 'added' <> '[{"kind": "bug-record", "version": 2}]'::jsonb then
    raise exception 'FAIL: a changed bug.md did not add its second version: %', answer;
  end if;
end $$;
reset role;

-- ── Nobody signed in writes the rows; the service role does not either ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115a1');
select pg_temp.refused($q$update public.fix_rows set merged_at = now()$q$, '42501', 'a member stamping a row');
select pg_temp.refused($q$delete from public.fix_rows$q$, '42501', 'a member deleting rows');
select pg_temp.refused($q$insert into public.fix_unmatched_merges (dossier_id, workspace_id, repository, pull, merged_at)
  select dossier_id, workspace_id, 'vertuoza/fix-api', 1, now() from public.fix_rows limit 1$q$, '42501', 'a member keeping an unmatched merge');
select pg_temp.refused($q$select public.fix_row_stamp('vertuoza/fix-api', 41, 'merged', now())$q$, '42501', 'a member stamping through the webhook''s function');
reset role;
set local role service_role;
select pg_temp.refused($q$update public.fix_rows set merged_at = now()$q$, '42501', 'the service role writing a row directly');
reset role;

-- ── The merge webhook stamps the rows (as the service role) ──
set local role service_role;
do $$
declare
  dossier uuid := pg_temp.made('mobile-B1');
  answer  jsonb;
  facts   jsonb;
begin
  -- The facts read the rows: three open, the first open pull request shown as in review.
  facts := (select f.facts from public.fix_facts f where f.dossier_id = dossier);
  if facts -> 'rows' <> '{"rows": 3, "open": 3, "closed": 0, "merged": 0, "shipped": false, "shippedAt": null, "unmatched": 0}'::jsonb
     or facts -> 'pull' <> '{"url": "https://github.com/vertuoza/fix-api/pull/41", "state": "open", "number": 41, "mergedAt": null, "mergedBy": null}'::jsonb
     or facts -> 'issue' <> 'null'::jsonb or facts -> 'approvals' <> '[]'::jsonb or facts -> 'release' <> 'null'::jsonb then
    raise exception 'FAIL: mobile-B1''s facts do not read its three open rows: %', facts;
  end if;

  -- The API's fix merges: its row is merged, the record is not shipped.
  answer := public.fix_row_stamp('Vertuoza/Fix-API', 41, 'merged', '2026-10-16T09:00:00Z');
  if answer <> jsonb_build_object('rows', jsonb_build_array(jsonb_build_object('bug', 'mobile-B1', 'dossierId', dossier, 'position', 1, 'state', 'merged')),
                                  'shipped', '[]'::jsonb, 'unmatched', null) then
    raise exception 'FAIL: a merge matching row 1 did not stamp it alone: %', answer;
  end if;
  -- A replay keeps the first merge.
  answer := public.fix_row_stamp('vertuoza/fix-api', 41, 'merged', '2026-10-16T10:00:00Z');
  if (select r.merged_at from public.fix_rows r where r.dossier_id = dossier and r.position = 1) <> '2026-10-16T09:00:00Z'
     or answer -> 'shipped' <> '[]'::jsonb then
    raise exception 'FAIL: a replayed merge moved the first one';
  end if;
  -- A close after the merge changes nothing.
  answer := public.fix_row_stamp('vertuoza/fix-api', 41, 'closed', '2026-10-16T11:00:00Z');
  if answer -> 'rows' <> '[]'::jsonb or (select r.state from public.fix_rows r where r.dossier_id = dossier and r.position = 1) <> 'merged' then
    raise exception 'FAIL: a close after the merge touched the merged row';
  end if;

  -- The app's #7 closes unmerged: its row reads closed, the record stays open; a reopen clears it.
  answer := public.fix_row_stamp('vertuoza/fix-app', 7, 'closed', '2026-10-16T09:30:00Z');
  if answer -> 'rows' -> 0 ->> 'state' <> 'closed'
     or (select r.closed_at from public.fix_rows r where r.dossier_id = dossier and r.position = 2) <> '2026-10-16T09:30:00Z' then
    raise exception 'FAIL: a close unmerged did not mark row 2: %', answer;
  end if;
  facts := (select f.facts from public.fix_facts f where f.dossier_id = dossier);
  if facts -> 'rows' ->> 'closed' <> '1' or facts -> 'rows' ->> 'merged' <> '1' or (facts -> 'rows' ->> 'shipped')::boolean then
    raise exception 'FAIL: the facts do not read one merged and one closed row: %', facts;
  end if;
  answer := public.fix_row_stamp('vertuoza/fix-app', 7, 'reopened', '2026-10-16T09:40:00Z');
  if answer -> 'rows' -> 0 ->> 'state' <> 'open' then
    raise exception 'FAIL: a reopen did not clear the close: %', answer;
  end if;

  -- A merge matching no row of the record its body names is kept, once, as unmatched.
  answer := public.fix_row_stamp('vertuoza/fix-app', 99, 'merged', '2026-10-16T09:50:00Z', 'mobile-B1');
  if answer <> '{"rows": [], "shipped": [], "unmatched": "mobile-B1"}'::jsonb then
    raise exception 'FAIL: an unmatched merge was not kept on mobile-B1: %', answer;
  end if;
  perform public.fix_row_stamp('vertuoza/fix-app', 99, 'merged', '2026-10-16T09:55:00Z', 'mobile-B1');
  if (select count(*) from public.fix_unmatched_merges u where u.dossier_id = dossier) <> 1
     or (select u.merged_at from public.fix_unmatched_merges u where u.dossier_id = dossier) <> '2026-10-16T09:50:00Z'
     or (select f.facts -> 'rows' ->> 'unmatched' from public.fix_facts f where f.dossier_id = dossier) <> '1' then
    raise exception 'FAIL: an unmatched merge was not kept exactly once';
  end if;
  -- A merge naming no record, a record of a product that does not hold the repository, or no such
  -- record, keeps nothing; neither does a close.
  if public.fix_row_stamp('vertuoza/fix-app', 98, 'merged', now()) <> '{"rows": [], "shipped": [], "unmatched": null}'::jsonb
     or public.fix_row_stamp('vertuoza/fix-web', 98, 'merged', now(), 'mobile-B1') ->> 'unmatched' is not null
     or public.fix_row_stamp('vertuoza/fix-app', 98, 'merged', now(), 'mobile-B9') ->> 'unmatched' is not null
     or public.fix_row_stamp('vertuoza/fix-app', 98, 'closed', now(), 'mobile-B1') ->> 'unmatched' is not null then
    raise exception 'FAIL: a merge that names no record of a product holding its repository was kept';
  end if;
  if (select count(*) from public.fix_unmatched_merges) <> 1 then
    raise exception 'FAIL: a merge naming no record kept something';
  end if;
  perform pg_temp.refused($q$select public.fix_row_stamp('vertuoza/fix-app', 7, 'approved', now())$q$, '22023', 'an unknown event');
  perform pg_temp.refused($q$select public.fix_row_stamp('vertuoza/fix-app', 7, 'merged', now(), 'mobile-12')$q$, '22023', 'a record named as a PRD');
  perform pg_temp.refused($q$select public.fix_row_stamp('fix-app', 7, 'merged', now())$q$, '22023', 'a repository with no owner');

  -- The last two merges: the last one ships the record, once.
  answer := public.fix_row_stamp('vertuoza/fix-app', 7, 'merged', '2026-10-16T12:00:00Z');
  if answer -> 'shipped' <> '[]'::jsonb then
    raise exception 'FAIL: a merge with a row still open shipped the record: %', answer;
  end if;
  answer := public.fix_row_stamp('vertuoza/fix-app', 8, 'merged', '2026-10-16T13:00:00Z');
  if answer -> 'shipped' <> '["mobile-B1"]'::jsonb then
    raise exception 'FAIL: the last merge did not ship mobile-B1: %', answer;
  end if;
  if public.fix_row_stamp('vertuoza/fix-app', 8, 'merged', '2026-10-16T14:00:00Z') -> 'shipped' <> '[]'::jsonb then
    raise exception 'FAIL: a replay of the last merge shipped the record again';
  end if;
  facts := (select f.facts from public.fix_facts f where f.dossier_id = dossier);
  if facts -> 'rows' <> '{"rows": 3, "open": 0, "closed": 0, "merged": 3, "shipped": true, "shippedAt": "2026-10-16T13:00:00+00:00", "unmatched": 1}'::jsonb
     or facts -> 'pull' <> '{"url": "https://github.com/vertuoza/fix-app/pull/8", "state": "merged", "number": 8, "mergedAt": "2026-10-16T13:00:00+00:00", "mergedBy": null}'::jsonb then
    raise exception 'FAIL: the facts do not read mobile-B1 shipped: %', facts;
  end if;

  -- A sync writing the facts again keeps what the rows say.
  update public.fix_facts f set facts = '{"issue": null, "pull": null, "approvals": [], "release": null}' where f.dossier_id = dossier;
  if (select f.facts -> 'rows' ->> 'shipped' from public.fix_facts f where f.dossier_id = dossier) <> 'true'
     or (select f.facts -> 'pull' ->> 'number' from public.fix_facts f where f.dossier_id = dossier) <> '8' then
    raise exception 'FAIL: a sync''s write dropped what the rows say';
  end if;
end $$;
reset role;

-- ── A merged row stays where it is, as it is ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115a1');
do $$
declare
  rows3 jsonb := jsonb_build_array(
    jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 41, 'changes', 'The token refresh keeps its session.'),
    jsonb_build_object('repo', 'vertuoza/fix-app', 'pull', 7, 'changes', 'The app retries once.'),
    jsonb_build_object('repo', 'vertuoza/fix-app', 'pull', 8, 'changes', 'The app says why.'));
  before_rows text;
begin
  -- Its words may change.
  perform public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('rows', rows3)));
  if (select r.changes || ' ' || r.state || ' ' || coalesce(r.guard, '-') from public.fix_rows r
       where r.dossier_id = pg_temp.made('mobile-B1') and r.position = 1) <> 'The token refresh keeps its session. merged -' then
    raise exception 'FAIL: a merged row''s words did not follow the push, or its merge was lost';
  end if;
  before_rows := pg_temp.rows_of();
  perform pg_temp.refused(format($q$select public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('rows', %L::jsonb)))$q$,
    jsonb_set(rows3, '{0,pull}', '42')), '22023', 'a merged row given another pull request', 'Row 1 of mobile-B1 merged');
  perform pg_temp.refused(format($q$select public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('rows', %L::jsonb)))$q$,
    jsonb_build_array(rows3 -> 1, rows3 -> 0, rows3 -> 2)), '22023', 'merged rows moved');
  perform pg_temp.refused(format($q$select public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('rows', %L::jsonb)))$q$,
    rows3 - 2), '22023', 'a merged row dropped', 'Row 3');
  if pg_temp.rows_of() <> before_rows then
    raise exception 'FAIL: a refused push changed a merged row';
  end if;

  -- An open row's pull request changes: it starts open again.
  perform public.fix_bug_push('mobile', 2, pg_temp.body(jsonb_build_object('title', 'A second bug', 'record', null, 'rows', jsonb_build_array(
    jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 50, 'changes', 'x')))));
end $$;
reset role;
set local role service_role;
select public.fix_row_stamp('vertuoza/fix-api', 50, 'closed', now());
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115a1');
do $$
begin
  perform public.fix_bug_push('mobile', 2, pg_temp.body(jsonb_build_object('title', 'A second bug', 'record', null, 'rows', jsonb_build_array(
    jsonb_build_object('repo', 'vertuoza/fix-api', 'pull', 51, 'changes', 'x')))));
  if (select r.state || ' ' || r.pull from public.fix_rows r where r.dossier_id = pg_temp.made('mobile-B2')) <> 'open 51' then
    raise exception 'FAIL: a closed row given a new pull request did not start open again';
  end if;
end $$;
reset role;

-- ── Who reads the rows ──
set local role anon;
select pg_temp.refused($q$select 1 from public.fix_rows$q$, '42501', 'anon reading the rows');
select pg_temp.refused($q$select 1 from public.fix_unmatched_merges$q$, '42501', 'anon reading the unmatched merges');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115b1');
do $$
begin
  if (select count(*) from public.fix_rows) <> 4 or (select count(*) from public.fix_unmatched_merges) <> 1 then
    raise exception 'FAIL: a member did not read their workspace''s rows and unmatched merges';
  end if;
end $$;
-- Carl, of Acme: none of Vertuoza's, and his own product's counter starts at 1.
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115c1');
do $$
begin
  if exists (select 1 from public.fix_rows) or exists (select 1 from public.fix_unmatched_merges) then
    raise exception 'FAIL: an account of another workspace read Vertuoza''s rows';
  end if;
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', 1, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
      jsonb_build_object('repo', 'acme-fixrows/app', 'changes', 'x')))))$q$, 'P0002', 'Carl pushing to a bug he does not have');
  if public.fix_bug_push('mobile', null, pg_temp.body(jsonb_build_object('rows', jsonb_build_array(
       jsonb_build_object('repo', 'acme-fixrows/app', 'changes', 'x'))))) ->> 'bug' <> 'mobile-B1' then
    raise exception 'FAIL: Acme''s product did not count its bugs on its own';
  end if;
  if (select count(*) from public.fix_rows) <> 1 then
    raise exception 'FAIL: Carl does not read his own bug''s row alone';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020115e1');
do $$
begin
  if exists (select 1 from public.fix_rows) or exists (select 1 from public.fix_unmatched_merges) then
    raise exception 'FAIL: an account in no workspace read fix rows';
  end if;
  perform pg_temp.refused($q$select public.fix_bug_push('mobile', null, pg_temp.body())$q$, 'P0002', 'an account in no workspace pushing a bug');
end $$;
reset role;

-- ── The rows go with their dossier ──
delete from public.dossiers where id = pg_temp.made('mobile-B1');
do $$
begin
  if exists (select 1 from public.fix_rows where dossier_id = pg_temp.made('mobile-B1'))
     or exists (select 1 from public.fix_unmatched_merges where dossier_id = pg_temp.made('mobile-B1'))
     or exists (select 1 from public.fix_facts where dossier_id = pg_temp.made('mobile-B1')) then
    raise exception 'FAIL: a bug''s rows, unmatched merges or facts outlived it';
  end if;
end $$;

rollback;

-- ── Two creates of a product bug at once: two numbers, no gap ──
-- Two sessions through dblink: the first create holds the product's row until it commits, so the second
-- waits on it, then takes the next number. The rows are committed (each session must see them) and
-- deleted at the end.
begin;
create extension if not exists dblink schema extensions;
do $$
declare
  link   constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  setup  constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000002011500';
    delete from auth.users where id = '00000000-0000-4000-8000-0000020115f1';
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000020115f1', 'race@fixrows.test');
    insert into public.workspaces (id, slug, name, github_org) values ('00000000-0000-4000-8000-000002011500', 'fr-race', 'FR Race', 'fr-race');
    insert into public.workspace_members (workspace_id, user_id) values ('00000000-0000-4000-8000-000002011500', '00000000-0000-4000-8000-0000020115f1');
    insert into public.businesses (id, workspace_id, name) values ('00000000-0000-4000-8000-0000020115f0', '00000000-0000-4000-8000-000002011500', 'FR Race');
    insert into public.products (id, workspace_id, business_id, name, key) values
      ('00000000-0000-4000-8000-0000020115e9', '00000000-0000-4000-8000-000002011500', '00000000-0000-4000-8000-0000020115f0', 'Mobile', 'mobile');
    insert into public.repositories (workspace_id, full_name) values ('00000000-0000-4000-8000-000002011500', 'fr-race/app');
    insert into public.product_repositories (product_id, workspace_id, repository, added_by) values
      ('00000000-0000-4000-8000-0000020115e9', '00000000-0000-4000-8000-000002011500', 'fr-race/app', 'person');
  $s$;
  teardown constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000002011500';
    delete from auth.users where id = '00000000-0000-4000-8000-0000020115f1';
  $s$;
  as_race constant text := $s$
    begin;
    set local role authenticated;
    set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-0000020115f1", "role": "authenticated"}';
  $s$;
  create_one constant text := $s$select public.fix_bug_push('mobile', null, jsonb_build_object(
    'title', 'Race', 'rows', jsonb_build_array(jsonb_build_object('repo', 'fr-race/app', 'changes', 'Both get a number.')))) ->> 'bug'$s$;
  first  text;
  second text;
  busy   integer;
begin
  perform extensions.dblink_connect('fr_setup', link);
  perform extensions.dblink_exec('fr_setup', setup);
  perform extensions.dblink_connect('fr_one', link);
  perform extensions.dblink_connect('fr_two', link);
  begin
    perform extensions.dblink_exec('fr_one', as_race);
    perform extensions.dblink_exec('fr_two', as_race);
    select r into first from extensions.dblink('fr_one', create_one) as t (r text);
    perform extensions.dblink_send_query('fr_two', create_one);
    perform pg_sleep(0.3);
    busy := extensions.dblink_is_busy('fr_two');
    perform extensions.dblink_exec('fr_one', 'commit');
    select r into second from extensions.dblink_get_result('fr_two') as t (r text);
    perform * from extensions.dblink_get_result('fr_two') as t (r text);
    perform extensions.dblink_exec('fr_two', 'commit');
    if busy <> 1 then
      raise exception 'FAIL: the second bug create did not wait on the first';
    end if;
    if first <> 'mobile-B1' or second <> 'mobile-B2' then
      raise exception 'FAIL: two bug creates at once took % and %, not mobile-B1 and mobile-B2', first, second;
    end if;
    if (select string_agg(n::text, ',' order by n) from extensions.dblink('fr_setup',
          $s$select product_seq from public.dossiers where product_id = '00000000-0000-4000-8000-0000020115e9' and kind = 'bug'$s$) as t (n integer)) <> '1,2' then
      raise exception 'FAIL: two bug creates at once did not leave mobile-B1 and mobile-B2';
    end if;
  exception when others then
    perform extensions.dblink_disconnect('fr_one');
    perform extensions.dblink_disconnect('fr_two');
    perform extensions.dblink_exec('fr_setup', teardown);
    perform extensions.dblink_disconnect('fr_setup');
    raise;
  end;
  perform extensions.dblink_disconnect('fr_one');
  perform extensions.dblink_disconnect('fr_two');
  perform extensions.dblink_exec('fr_setup', teardown);
  perform extensions.dblink_disconnect('fr_setup');
end $$;
rollback;

select 'fix rows checks passed' as result;
