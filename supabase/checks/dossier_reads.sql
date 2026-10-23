-- The PRD list's and a PRD page's lighter reads (PRD 2401 s3). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/dossier_reads.sql
-- dossier_list(p_kind => 'prd') lists only PRDs, and every kind without p_kind, each row as it was;
-- dossier_repos(p_dossier) gives the same repositories, question counts and version counts
-- dossier_list(p_dossier) gives, and nothing of a workspace its caller is not in; a plan version
-- keeps its slice count (plan_slice_count(), as the kit's parsePlanSlices() counts), set when it is
-- added. Accounts each with its own JWT, under row-level security. One transaction, rolled back at
-- the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to both, Bob to Initech, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, m.joined_at
  from (values
         ('initech', '00000000-0000-4000-8000-0000000000a1'::uuid, now() - interval '2 days'),
         ('acme',    '00000000-0000-4000-8000-0000000000a1'::uuid, now() - interval '1 day'),
         ('initech', '00000000-0000-4000-8000-0000000000b1'::uuid, now() - interval '1 day'),
         ('acme',    '00000000-0000-4000-8000-0000000000c1'::uuid, now() - interval '1 day')
       ) as m (slug, user_id, joined_at)
  join public.workspaces w on w.slug = m.slug;

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- The ids the blocks below share.
create temporary table ids (name text primary key, id uuid);
create temporary table workspace_ids (name text primary key, id uuid);
grant select on ids, workspace_ids to authenticated;

-- ── The fixture, as the database owner ──
-- Initech's PRD 40 of its plan repository, opened in the Claude session sess-r: a brainstorm question
-- asked in initech/nimbus-brain and answered, a delivery question asked in its home repository, its
-- planet surveyed in nimbus-web; its spec, a plan of three slices, then a plan of two. Initech's bug
-- 41 and visual fix 42 of initech/tiles, and a draft. Acme's PRD 40 of acme/plans, opened in the
-- Claude session sess-acme, which asked in acme/secret. Versions are added through
-- dossier_add_version(), as every push adds them.
do $$
declare
  initech constant uuid := (select id from public.workspaces where slug = 'initech');
  acme constant uuid := (select id from public.workspaces where slug = 'acme');
  ada constant uuid := '00000000-0000-4000-8000-0000000000a1';
  bob constant uuid := '00000000-0000-4000-8000-0000000000b1';
  carl constant uuid := '00000000-0000-4000-8000-0000000000c1';
  asked constant jsonb := '[{"question": "Monthly or weekly?", "header": "Cadence", "multiSelect": false,
                             "options": [{"label": "Monthly", "description": "calmer"}, {"label": "Weekly", "description": "sooner"}]}]';
  prd40 constant uuid := gen_random_uuid();
  bug41 constant uuid := gen_random_uuid();
  visual42 constant uuid := gen_random_uuid();
  draft constant uuid := gen_random_uuid();
  acme40 constant uuid := gen_random_uuid();
  s_brainstorm uuid;
  s_delivery uuid;
  s_acme uuid;
  r_brainstorm uuid;
begin
  insert into ids values ('prd40', prd40), ('bug41', bug41), ('visual42', visual42), ('draft', draft), ('acme40', acme40);
  -- Acme itself, which Bob cannot read: kept apart from the dossiers.
  insert into workspace_ids values ('acme', acme);
  insert into public.dossiers (id, workspace_id, home_repo, prd, kind, title, opened_by, claude_session_id, created_at, numbered_at) values
    (prd40,    initech, 'initech/nimbus-plan', 40,   'prd',    'Invoice reminders', ada,  'sess-r', now() - interval '3 days', now() - interval '71 hours'),
    (bug41,    initech, 'initech/tiles',       41,   'bug',    'Tiles crack',       bob,  null,     now() - interval '2 days', now() - interval '2 days'),
    (visual42, initech, 'initech/tiles',       42,   'visual', 'Tile shadows',      bob,  null,     now() - interval '1 day',  now() - interval '1 day'),
    (draft,    initech, 'initech/tiles',       null, 'prd',    'Grout colours',     bob,  null,     now() - interval '6 days', null),
    (acme40,   acme,    'acme/plans',          40,   'prd',    'Acme reminders',    carl, 'sess-acme', now() - interval '2 days', now() - interval '2 days');
  perform public.dossier_add_version(prd40, 'spec', 'reminders spec', 'kit', ada);
  perform public.dossier_add_version(prd40, 'plan', E'# Plan\n\n| id | slice | territory |\n| --- | --- | --- |\n| s1 | one | `a/` |\n| s2 | two | `b/` |\n| s3 | three | `c/` |\n', 'kit', ada);
  perform public.dossier_add_version(prd40, 'plan', E'# Plan\n\n| id | slice | territory |\n|---|---|---|\n| s1 | one | `a/` |\n| s2 | two | `b/` |\n', 'kit', ada);
  perform public.dossier_add_version(bug41, 'bug-record', 'the record', 'kit', bob);
  perform public.dossier_add_version(visual42, 'before-after', 'the page', 'kit', bob);
  perform public.dossier_add_version(acme40, 'spec', 'acme spec', 'kit', carl);

  insert into public.ledger_events (workspace_id, id, at, type, planet, region) values
    (initech, 'check:region:nimbus-web:40:surveyed', now() - interval '40 hours', 'REGION_SURVEYED', 40, 'nimbus-web');

  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (ada, 'nimbus-brain · main', 'Initech/Nimbus-Brain', 'main', 'sess-r') returning id into s_brainstorm;
  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (bob, 'nimbus-plan · feat/invoice-reminders--s1', 'initech/nimbus-plan', 'feat/invoice-reminders--s1', 'sess-rb')
  returning id into s_delivery;
  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (carl, 'secret · main', 'acme/secret', 'main', 'sess-acme') returning id into s_acme;
  insert into public.ask_rounds (session_id, questions, created_at, prd, skill)
  values (s_brainstorm, asked, now() - interval '2 days', null, '/omni:brainstorm') returning id into r_brainstorm;
  insert into public.ask_rounds (session_id, questions, created_at, prd, skill)
  values (s_delivery, asked, now() - interval '1 hour', 40, '/omni:do-work');
  insert into public.ask_rounds (session_id, questions, created_at, prd, skill)
  values (s_acme, asked, now() - interval '1 hour', 40, '/omni:do-work');
  update public.ask_rounds set status = 'answered', answers = '{"Monthly or weekly?": "Monthly"}', answered_via = 'terminal'
   where id = r_brainstorm;
end $$;

-- ── A plan version keeps its slice count, as the kit counts it ──
do $$
declare
  got integer;
begin
  -- The first table whose header starts with `id` and names a `territory` column, its rows with an id.
  got := public.plan_slice_count(E'| id | slice | territory |\n| --- | --- | --- |\n| s1 | a | `x/` |\n| s2 | b | `y/` |');
  if got is distinct from 2 then raise exception 'FAIL: two slices counted as %', got; end if;
  -- An earlier `id` table without territory is passed over; a row with an empty id is skipped; the
  -- table ends at the first line that is not a row.
  got := public.plan_slice_count(E'| id | what |\n|---|---|\n| s9 | x |\n\n## Slices\n\n  | ID | Territory | wave |\n  |:--|:--|--:|\n  | s1 | `a/` | 1 |\n  |  | `b/` | 1 |\n  | s2 | `c/` | 2 |\n\n| s3 | `d/` | 3 |');
  if got is distinct from 2 then raise exception 'FAIL: the slice table''s rows counted as %, not 2', got; end if;
  -- Windows line ends read the same.
  got := public.plan_slice_count(E'| id | territory |\r\n| --- | --- |\r\n| s1 | `a/` |\r\n');
  if got is distinct from 1 then raise exception 'FAIL: a plan with CRLF line ends counted as %', got; end if;
  -- Nothing the kit cannot read counts: no table, no territory column, no slice, an id that is no slice id.
  got := public.plan_slice_count('# A plan with no table');
  if got is distinct from 0 then raise exception 'FAIL: a plan with no table counted as %', got; end if;
  got := public.plan_slice_count(E'| id | slice |\n| --- | --- |\n| s1 | a |');
  if got is distinct from 0 then raise exception 'FAIL: a table with no territory column counted as %', got; end if;
  got := public.plan_slice_count(E'| id | territory |\n| --- | --- |');
  if got is distinct from 0 then raise exception 'FAIL: a slice table with no slice counted as %', got; end if;
  got := public.plan_slice_count(E'| id | territory |\n| --- | --- |\n| s1 | `a/` |\n| Slice 2 | `b/` |');
  if got is distinct from 0 then raise exception 'FAIL: a table naming no slice id counted as %', got; end if;
  got := public.plan_slice_count(null);
  if got is distinct from 0 then raise exception 'FAIL: no plan counted as %', got; end if;

  -- Each plan version keeps its count; every other kind keeps none.
  if (select array_agg(v.slices order by v.created_at) from public.dossier_versions v
       where v.dossier_id = (select id from ids where name = 'prd40') and v.kind = 'plan') is distinct from array[3, 2] then
    raise exception 'FAIL: the plan versions kept %, not {3,2}',
      (select array_agg(v.slices order by v.created_at) from public.dossier_versions v
        where v.dossier_id = (select id from ids where name = 'prd40') and v.kind = 'plan');
  end if;
  if exists (select 1 from public.dossier_versions v where v.kind <> 'plan' and v.slices is not null) then
    raise exception 'FAIL: a version that is no plan kept a slice count';
  end if;
end $$;

-- ── Bob, a member of Initech: dossier_list(p_kind) lists only that kind, each row as without it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@example.com');
do $$
declare
  every_kind text;
  only_prd text;
  rows_differ integer;
begin
  select string_agg(i.name, ' ' order by i.name) into every_kind
    from public.dossier_list() l join ids i on i.id = l.id;
  if every_kind is distinct from 'bug41 draft prd40 visual42' then
    raise exception 'FAIL: dossier_list() listed % for Bob, not every kind of Initech''s', every_kind;
  end if;
  select string_agg(i.name, ' ' order by i.name) into only_prd
    from public.dossier_list(p_kind => 'prd') l join ids i on i.id = l.id;
  if only_prd is distinct from 'draft prd40' then
    raise exception 'FAIL: dossier_list(p_kind => prd) listed % for Bob, not Initech''s PRDs', only_prd;
  end if;
  if (select count(*) from public.dossier_list(p_kind => 'bug')) <> 1
     or (select count(*) from public.dossier_list(p_kind => 'visual')) <> 1
     or (select count(*) from public.dossier_list(p_kind => 'concept')) <> 0 then
    raise exception 'FAIL: dossier_list(p_kind) did not list each kind on its own';
  end if;
  -- Each row with p_kind is the row without it, column for column.
  select count(*) into rows_differ
    from (select * from public.dossier_list(p_kind => 'prd')
          except
          select * from public.dossier_list() l where l.kind = 'prd') d;
  if rows_differ <> 0 then
    raise exception 'FAIL: % rows of dossier_list(p_kind => prd) differ from dossier_list()''s', rows_differ;
  end if;
  -- p_kind narrows p_dossier and p_workspace, and widens nothing.
  if (select count(*) from public.dossier_list(p_dossier => (select id from ids where name = 'bug41'), p_kind => 'prd')) <> 0 then
    raise exception 'FAIL: dossier_list(p_dossier, p_kind) listed a dossier of another kind';
  end if;
  if (select count(*) from public.dossier_list(p_workspace => (select id from workspace_ids where name = 'acme'), p_kind => 'prd')) <> 0 then
    raise exception 'FAIL: dossier_list(p_workspace, p_kind) listed Acme''s PRD to Bob';
  end if;
end $$;

-- ── Bob: dossier_repos() gives what dossier_list(p_dossier) gives, its repositories and its counts ──
do $$
declare
  d record;
  r record;
  l record;
begin
  for d in select i.name, i.id from ids i loop
    select * into r from public.dossier_repos(d.id);
    select * into l from public.dossier_list(p_dossier => d.id);
    if d.name = 'acme40' then
      if r.id is not null then raise exception 'FAIL: dossier_repos() gave Bob Acme''s PRD'; end if;
      continue;
    end if;
    if r.id is distinct from d.id then raise exception 'FAIL: dossier_repos() gave Bob nothing of %', d.name; end if;
    if r.repos is distinct from l.repos then
      raise exception 'FAIL: dossier_repos() gave % the repositories %, dossier_list() %', d.name, r.repos, l.repos;
    end if;
    if r.asked is distinct from l.asked or r.answered is distinct from l.answered then
      raise exception 'FAIL: dossier_repos() counted % rounds of %, % answered; dossier_list() %, %', r.asked, d.name, r.answered, l.asked, l.answered;
    end if;
    if r.latest is distinct from (select coalesce(jsonb_object_agg(k.key, (k.value ->> 'version')::integer), '{}'::jsonb) from jsonb_each(l.latest) k) then
      raise exception 'FAIL: dossier_repos() gave % the versions %, dossier_list() %', d.name, r.latest, l.latest;
    end if;
  end loop;
  -- PRD 40: its home first, then its questions' repository and its planet's region; two rounds, one
  -- answered; its spec at v1 and its plan at v2.
  select * into r from public.dossier_repos((select id from ids where name = 'prd40'));
  if r.repos is distinct from array['initech/nimbus-plan', 'initech/nimbus-brain', 'initech/nimbus-web'] then
    raise exception 'FAIL: PRD 40''s repositories are %', r.repos;
  end if;
  if r.asked <> 2 or r.answered <> 1 or r.latest is distinct from '{"spec": 1, "plan": 2}'::jsonb then
    raise exception 'FAIL: PRD 40''s pulse is % asked, % answered, %', r.asked, r.answered, r.latest;
  end if;
  if (select count(*) from public.dossier_repos(gen_random_uuid())) <> 0 then
    raise exception 'FAIL: dossier_repos() gave a row for no dossier';
  end if;
end $$;

-- ── Carl, of Acme: nothing of Initech's, and never Initech's repositories in Acme's ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
declare
  r record;
begin
  if exists (select 1 from ids i, public.dossier_repos(i.id) x where i.name <> 'acme40') then
    raise exception 'FAIL: dossier_repos() gave Carl a dossier of Initech';
  end if;
  if exists (select 1 from public.dossier_list(p_kind => 'prd') l where l.id <> (select id from ids where name = 'acme40')) then
    raise exception 'FAIL: dossier_list(p_kind => prd) listed Carl a dossier of Initech';
  end if;
  select * into r from public.dossier_repos((select id from ids where name = 'acme40'));
  if r.repos is distinct from array['acme/plans', 'acme/secret'] or r.asked <> 1 or r.answered <> 0 then
    raise exception 'FAIL: Acme''s PRD 40 reads % with % rounds for Carl', r.repos, r.asked;
  end if;
end $$;

-- ── Ada, a member of both: each dossier with its own workspace's repositories only ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@example.com');
do $$
begin
  if (select x.repos from public.dossier_repos((select id from ids where name = 'prd40')) x)
     is distinct from array['initech/nimbus-plan', 'initech/nimbus-brain', 'initech/nimbus-web'] then
    raise exception 'FAIL: Ada reads PRD 40 with another workspace''s repositories';
  end if;
  if (select x.repos from public.dossier_repos((select id from ids where name = 'acme40')) x)
     is distinct from array['acme/plans', 'acme/secret'] then
    raise exception 'FAIL: Ada reads Acme''s PRD 40 with another workspace''s repositories';
  end if;
end $$;

-- ── Eve, in no workspace: nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from ids i, public.dossier_repos(i.id) x) then
    raise exception 'FAIL: dossier_repos() gave Eve a dossier';
  end if;
  if exists (select 1 from public.dossier_list(p_kind => 'prd')) then
    raise exception 'FAIL: dossier_list(p_kind => prd) listed Eve a dossier';
  end if;
end $$;

-- ── Signed out: refused ──
reset role;
set local role anon;
do $$
begin
  begin perform public.dossier_repos((select id from ids where name = 'prd40')); raise exception 'FAIL: anon read dossier_repos()';
  exception when insufficient_privilege then null; end;
  begin perform public.dossier_list(p_kind => 'prd'); raise exception 'FAIL: anon read dossier_list(p_kind)';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Both run as their caller, a signed-in member reads the slice count, and nobody else calls them ──
reset role;
do $$
begin
  if (select p.prosecdef from pg_proc p where p.oid = 'public.dossier_repos(uuid)'::regprocedure) then
    raise exception 'FAIL: dossier_repos() is security definer';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = 'public.dossier_list(uuid, uuid, text)'::regprocedure) then
    raise exception 'FAIL: dossier_list() is security definer';
  end if;
  if to_regprocedure('public.dossier_list(uuid, uuid)') is not null then
    raise exception 'FAIL: the two-argument dossier_list() is still there, so a call could be ambiguous';
  end if;
  if has_function_privilege('anon', 'public.dossier_repos(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.dossier_repos(uuid)', 'execute') then
    raise exception 'FAIL: dossier_repos() is not granted to the signed-in only';
  end if;
  if has_function_privilege('anon', 'public.dossier_list(uuid, uuid, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.dossier_list(uuid, uuid, text)', 'execute') then
    raise exception 'FAIL: dossier_list() is not granted to the signed-in only';
  end if;
  if not has_column_privilege('authenticated', 'public.dossier_versions', 'slices', 'select')
     or has_column_privilege('authenticated', 'public.dossier_versions', 'slices', 'update')
     or has_column_privilege('anon', 'public.dossier_versions', 'slices', 'select') then
    raise exception 'FAIL: the slice count is not readable by the signed-in only, or is writable';
  end if;
end $$;

rollback;
