-- The Omni Loop bug team (PRD 3088 s2). The supabase workflow runs it on every pull request, after `supabase db start` has
-- applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/omni_bug_team.sql
-- A mission's kind is `prds` unless it says `omni-bugs`, and nothing else; a `prds` mission's scope holds a PRD or a roadmap,
-- an `omni-bugs` mission's holds none. At most one `omni-bugs` mission is live (running, waiting or paused) at a time,
-- whichever workspace holds it: a second is refused, a draft or a stopped one is not counted (AC-10). mission_push() reads
-- the brief's kind, `prds` when it names none: an `omni-bugs` brief with an empty scope files its mission, a kind off the
-- list or a scope on an `omni-bugs` brief is refused naming its field, and a push never changes a mission's kind. A bug
-- report reads `open` with no attempt when filed; its state is one of seven; its attempts go 1, 2 and 3, and a 4th is
-- refused (AC-4); its fix pull request is a number, its release a version, and it reads `fixed` only with that version. Nobody
-- signed in reads or writes a bug report, its new columns included; a member of another workspace reads none of the team's
-- mission, nor its events (AC-9). A job's mission_key may be a bug's k-th run, `mission:<id>:bug:<issue>:run:<k>`; a
-- mission event may be bug-taken, bug-asked or bug-fixed. Its migration runs twice. One transaction, rolled back at the end.
-- Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000308a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000308c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000308e1', 'eve@example.com');
-- Ada owns Initech; Carl belongs to Acme; Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme-bug-team', 'Acme', 'acme-bug-team');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',       '00000000-0000-4000-8000-0000000308a1'::uuid, 'owner'),
         ('acme-bug-team', '00000000-0000-4000-8000-0000000308c1'::uuid, 'member')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
-- Initech's Virtual Fleet BUG SHIFT; Acme's own, ACME SHIFT.
insert into public.teams (workspace_id, name, label, color, sort, kind)
select w.id, f.name, f.label, '#8bd450', 100, 'virtual'
  from public.workspaces w
  join (values ('initech', 'bug-shift', 'BUG SHIFT'), ('acme-bug-team', 'acme-shift', 'ACME SHIFT')) as f (slug, name, label) on f.slug = w.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Mission <number> of a workspace's repository, of a kind, in a status: its id.
create function pg_temp.mission(p_slug text, p_repo text, p_fleet text, p_number integer, p_kind text, p_scope jsonb, p_status text default 'draft')
returns uuid language sql as $$
  insert into public.missions (workspace_id, repo, fleet, number, title, goal, scope, kind, status)
  select w.id, p_repo, p_fleet, p_number, 'Mission ' || p_number, 'Fix what the missions report.', p_scope, p_kind, p_status
    from public.workspaces w where w.slug = p_slug
  returning id;
$$;

-- A statement that must be refused with SQLSTATE `state`.
create function pg_temp.refused(statement text, state text, why text) returns void language plpgsql as $$
declare
  s text;
begin
  execute statement;
  raise exception 'FAIL: % was not refused', why;
exception when others then
  get stacked diagnostics s = returned_sqlstate;
  if s like 'P0001' then raise; end if;
  if s is distinct from state then
    raise exception 'FAIL: % was refused with % instead of %: %', why, s, state, sqlerrm;
  end if;
end;
$$;

-- The team's mission's brief, its fields overridden by `extra`.
create function pg_temp.brief(extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'kind', 'omni-bugs', 'fleet', 'bug-shift', 'goal', 'Fix the Omni Loop bugs missions report',
    'measures', '[]'::jsonb, 'scope', jsonb_build_object('prds', '[]'::jsonb, 'roadmaps', '[]'::jsonb),
    'mandate', jsonb_build_object('parallel', 2)
  ) || extra;
$$;
-- Mission <number>'s mission.md.
create function pg_temp.files(number integer) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('kind', 'mission-record', 'content', format(E'---\nmission: %s\n---\n', number)));
$$;
-- A push that must be refused for its field: SQLSTATE 22023 and the field as its hint.
create function pg_temp.push_refused(number integer, brief jsonb, field text) returns void language plpgsql as $$
declare
  h text;
begin
  perform public.mission_push('initech/nimbus-plan', number, 'The bug team', brief, pg_temp.files(number));
  raise exception 'FAIL: a push was not refused for its %: %', field, brief;
exception when invalid_parameter_value then
  get stacked diagnostics h = pg_exception_hint;
  if h is distinct from field then
    raise exception 'FAIL: a push was refused for % instead of its %', h, field;
  end if;
end;
$$;

grant execute on function pg_temp.sign_in(text), pg_temp.mission(text, text, text, integer, text, jsonb, text), pg_temp.refused(text, text, text),
  pg_temp.brief(jsonb), pg_temp.files(integer), pg_temp.push_refused(integer, jsonb, text) to authenticated, service_role;

-- ── A mission's kind, and the scope it holds ──
set local role service_role;
do $$
declare
  plain uuid;
begin
  insert into public.missions (workspace_id, repo, fleet, number, title, goal, scope)
  select w.id, 'initech/nimbus-plan', 'beaver', 3090, 'Paid online', 'Every quote can be paid online.', '{"prds": [3091], "roadmaps": []}'::jsonb
    from public.workspaces w where w.slug = 'initech'
  returning id into plain;
  if (select kind from public.missions where id = plain) is distinct from 'prds' then
    raise exception 'FAIL: a mission that names no kind does not read prds';
  end if;
  perform pg_temp.refused($q$select pg_temp.mission('initech', 'initech/nimbus-plan', 'beaver', 3092, 'bugs', '{"prds": [], "roadmaps": []}')$q$,
                          '23514', 'a kind off the list');
  perform pg_temp.refused($q$select pg_temp.mission('initech', 'initech/nimbus-plan', 'beaver', 3092, 'prds', '{"prds": [], "roadmaps": []}')$q$,
                          '23514', 'a prds mission with an empty scope');
  perform pg_temp.refused($q$select pg_temp.mission('initech', 'initech/nimbus-plan', 'beaver', 3092, 'omni-bugs', '{"prds": [3091], "roadmaps": []}')$q$,
                          '23514', 'an omni-bugs mission with a PRD in its scope');
  perform pg_temp.refused($q$select pg_temp.mission('initech', 'initech/nimbus-plan', 'beaver', 3092, 'omni-bugs', '{"prds": []}')$q$,
                          '23514', 'an omni-bugs mission with a scope of another shape');
end $$;

-- ── One live omni-bugs mission, whichever workspace holds it (AC-10) ──
do $$
declare
  team uuid := pg_temp.mission('initech', 'initech/nimbus-plan', 'beaver', 3093, 'omni-bugs', '{"prds": [], "roadmaps": []}', 'running');
  other uuid := pg_temp.mission('initech', 'initech/nimbus-plan', 'beaver', 3094, 'omni-bugs', '{"prds": [], "roadmaps": []}');
  live text;
begin
  -- A second omni-bugs mission is drafted, never started while the first is live.
  foreach live in array array['running', 'waiting', 'paused'] loop
    update public.missions set status = live where id = team;
    perform pg_temp.refused(format($q$update public.missions set status = 'running' where id = %L$q$, other), '23505',
                            format('a second omni-bugs mission started while the first is %s', live));
  end loop;
  perform pg_temp.refused($q$select pg_temp.mission('acme-bug-team', 'acme-bug-team/widgets', 'acme-shift', 3095, 'omni-bugs', '{"prds": [], "roadmaps": []}', 'running')$q$,
                          '23505', 'an omni-bugs mission of another workspace started while one is live');
  -- A prds mission is never counted.
  perform pg_temp.mission('initech', 'initech/nimbus-plan', 'beaver', 3096, 'prds', '{"prds": [3091], "roadmaps": []}', 'running');
  -- A stopped one is not live: the next one starts.
  update public.missions set status = 'stopped' where id = team;
  update public.missions set status = 'running' where id = other;
  if (select count(*) from public.missions where kind = 'omni-bugs' and status = 'running') <> 1 then
    raise exception 'FAIL: the second omni-bugs mission did not start once the first stopped';
  end if;
  update public.missions set status = 'stopped' where id = other;
end $$;
reset role;

-- ── mission_push() reads the brief's kind ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000308a1');
do $$
declare
  got jsonb;
  m public.missions;
begin
  got := public.mission_push('initech/nimbus-plan', 3097, 'The bug team', pg_temp.brief(), pg_temp.files(3097));
  select * into m from public.missions where number = 3097;
  if m.id is null or m.id <> (got #>> '{mission,id}')::uuid then raise exception 'FAIL: the member does not read the team''s mission pushed'; end if;
  if (m.kind, m.scope, m.status) is distinct from ('omni-bugs'::text, '{"prds": [], "roadmaps": []}'::jsonb, 'draft'::text) then
    raise exception 'FAIL: the team''s mission is not as pushed: %', row(m.*);
  end if;
  -- An omni-bugs brief that names no scope reads an empty one.
  perform public.mission_push('initech/nimbus-plan', 3098, 'The bug team', pg_temp.brief() - 'scope', pg_temp.files(3098));
  if (select scope from public.missions where number = 3098) is distinct from '{"prds": [], "roadmaps": []}'::jsonb then
    raise exception 'FAIL: an omni-bugs brief with no scope did not read an empty one';
  end if;
  -- A brief that names no kind is a prds mission's, as before.
  perform public.mission_push('initech/nimbus-plan', 3099, 'Paid online',
    pg_temp.brief(jsonb_build_object('scope', jsonb_build_object('prds', jsonb_build_array(3091), 'roadmaps', '[]'::jsonb))) - 'kind',
    pg_temp.files(3099));
  if (select kind from public.missions where number = 3099) is distinct from 'prds' then
    raise exception 'FAIL: a brief that names no kind did not file a prds mission';
  end if;

  perform pg_temp.push_refused(3100, pg_temp.brief('{"kind": "bugs"}'), 'kind');
  perform pg_temp.push_refused(3100, pg_temp.brief('{"kind": 1}'), 'kind');
  perform pg_temp.push_refused(3100, pg_temp.brief('{"scope": {"prds": [3091], "roadmaps": []}}'), 'scope');
  perform pg_temp.push_refused(3100, pg_temp.brief('{"kind": "prds"}'), 'scope');
  -- A push never changes a mission's kind.
  perform pg_temp.push_refused(3097, pg_temp.brief('{"kind": "prds", "scope": {"prds": [3091], "roadmaps": []}}'), 'kind');
  perform pg_temp.push_refused(3099, pg_temp.brief(), 'kind');
  if (select kind from public.missions where number = 3097) is distinct from 'omni-bugs' then
    raise exception 'FAIL: a push changed the team''s mission''s kind';
  end if;
end $$;
reset role;

-- ── A bug report's state, attempts, fix and release ──
set local role service_role;
do $$
declare
  fp constant text := '3088308830883088000000000000000000000000000000000000000000000000';
  got public.omni_bug_reports;
  next_state text;
begin
  insert into public.omni_bug_reports (fingerprint, repo, issue, count) values (fp, 'vertuoza/vertuo-omni-loop', 3101, 7) returning * into got;
  if (got.state, got.attempts, got.fix_pr, got.fixed_in, got.asked_job)
     is distinct from ('open'::text, 0::smallint, null::integer, null::text, null::uuid) then
    raise exception 'FAIL: a bug report filed does not read open with no attempt: %', row(got.*);
  end if;

  foreach next_state in array array['open', 'fixing', 'pr-opened', 'asked', 'merged', 'wont-fix'] loop
    update public.omni_bug_reports set state = next_state where fingerprint = fp;
  end loop;
  perform pg_temp.refused(format($q$update public.omni_bug_reports set state = 'done' where fingerprint = %L$q$, fp), '23514', 'a state off the list');
  perform pg_temp.refused(format($q$update public.omni_bug_reports set state = 'fixed' where fingerprint = %L$q$, fp), '23514', 'fixed with no release');
  perform pg_temp.refused(format($q$update public.omni_bug_reports set fixed_in = 'v0.0.680' where fingerprint = %L$q$, fp), '23514', 'a release that is no version');
  perform pg_temp.refused(format($q$update public.omni_bug_reports set fix_pr = 0 where fingerprint = %L$q$, fp), '23514', 'a fix pull request numbered 0');
  update public.omni_bug_reports set state = 'fixed', fixed_in = '0.0.680', fix_pr = 3102, asked_job = '00000000-0000-4000-8000-000003088b01'
   where fingerprint = fp returning * into got;
  if (got.state, got.fix_pr, got.fixed_in, got.asked_job)
     is distinct from ('fixed'::text, 3102, '0.0.680'::text, '00000000-0000-4000-8000-000003088b01'::uuid) then
    raise exception 'FAIL: a bug report did not read fixed in its release: %', row(got.*);
  end if;

  -- Three attempts at most (AC-4).
  update public.omni_bug_reports set attempts = 1 where fingerprint = fp;
  update public.omni_bug_reports set attempts = 2 where fingerprint = fp;
  update public.omni_bug_reports set attempts = 3 where fingerprint = fp;
  perform pg_temp.refused(format($q$update public.omni_bug_reports set attempts = attempts + 1 where fingerprint = %L$q$, fp), '23514', 'a 4th attempt');
  perform pg_temp.refused(format($q$update public.omni_bug_reports set attempts = -1 where fingerprint = %L$q$, fp), '23514', 'a negative attempt');
  if (select attempts from public.omni_bug_reports where fingerprint = fp) <> 3 then raise exception 'FAIL: a refused attempt was counted'; end if;

  -- A repeat is still counted in one statement, the row as it now stands.
  select * into got from public.omni_bug_report_seen(fp);
  if (got.count, got.state, got.attempts) is distinct from (8, 'fixed'::text, 3::smallint) then
    raise exception 'FAIL: a repeat did not keep the bug''s state: %', row(got.*);
  end if;
end $$;

-- ── A bug's job key and the team's three event kinds ──
do $$
declare
  team uuid := (select id from public.missions where number = 3093);
  ws uuid := (select workspace_id from public.missions where number = 3093);
  label text;
begin
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key) values
    (ws, '/omni:bug-fix #3101', 'initech/nimbus-plan', 'omni-app', team, format('mission:%s:bug:3101:run:1', team)),
    (ws, '/omni:bug-fix #3101', 'initech/nimbus-plan', 'omni-app', team, format('mission:%s:bug:3101:run:2', team)),
    (ws, '/omni:yolo 3091', 'initech/nimbus-plan', 'omni-app', team, format('mission:%s:prd:3091:run:1', team));
  perform pg_temp.refused(format($q$insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
                                    values (%L, '/omni:bug-fix #3101', 'initech/nimbus-plan', 'omni-app', %L, %L)$q$,
                                 ws, team, format('mission:%s:bug:3101:run:1', team)), '23505', 'a bug''s run sent twice');
  foreach label in array array[format('mission:%s:bug:0:run:1', team), format('mission:%s:bug:3101:run:0', team),
                               format('mission:%s:bug:3101', team), format('mission:%s:bug:#3101:run:1', team)] loop
    perform pg_temp.refused(format($q$insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
                                      values (%L, '/omni:bug-fix', 'initech/nimbus-plan', 'omni-app', %L, %L)$q$, ws, team, label),
                            '23514', format('the malformed key %s', label));
  end loop;

  foreach label in array array['bug-taken', 'bug-asked', 'bug-fixed'] loop
    insert into public.mission_events (mission_id, role, actor, kind, sentence, link)
    values (team, 'supervisor', 'agent', label, format('Omni Loop bug #3101: %s.', label), 'https://github.com/vertuoza/vertuo-omni-loop/issues/3101');
  end loop;
  perform pg_temp.refused(format($q$insert into public.mission_events (mission_id, role, actor, kind, sentence) values (%L, 'supervisor', 'agent', 'bug-closed', 'x')$q$, team),
                          '23514', 'an event kind off the list');
end $$;
reset role;

-- ── Nobody signed in reads a bug report, nor another workspace's team (AC-9) ──
set local role anon;
do $$
begin
  begin perform 1 from public.omni_bug_reports limit 1; raise exception 'FAIL: anon read the Omni Loop bug reports';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000308a1');
do $$
begin
  begin perform state, attempts, fix_pr, fixed_in, asked_job from public.omni_bug_reports limit 1;
    raise exception 'FAIL: a member read the Omni Loop bug reports';
  exception when insufficient_privilege then null; end;
  begin update public.omni_bug_reports set attempts = 0; raise exception 'FAIL: a member wrote an Omni Loop bug report';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.missions where kind = 'omni-bugs') <> 4 then
    raise exception 'FAIL: the owner does not read their workspace''s omni-bugs missions';
  end if;
  if (select count(*) from public.mission_events where kind like 'bug-%') <> 3 then
    raise exception 'FAIL: the owner does not read the team''s three events';
  end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000308c1');
do $$
begin
  begin perform 1 from public.omni_bug_reports limit 1; raise exception 'FAIL: a member of another workspace read the Omni Loop bug reports';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.missions where kind = 'omni-bugs') then
    raise exception 'FAIL: a member of another workspace read the team''s mission';
  end if;
  if exists (select 1 from public.mission_events where kind like 'bug-%') then
    raise exception 'FAIL: a member of another workspace read the team''s events';
  end if;
  if exists (select 1 from public.runner_jobs where mission_key like 'mission:%:bug:%') then
    raise exception 'FAIL: a member of another workspace read the team''s jobs';
  end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000308e1');
do $$
begin
  if exists (select 1 from public.missions where kind = 'omni-bugs') then
    raise exception 'FAIL: an account of no workspace read the team''s mission';
  end if;
end $$;
reset role;

-- ── Its migration runs twice ──
set local client_min_messages = warning;
\ir ../migrations/20270127100000_omni_bug_team.sql
reset client_min_messages;

do $$
begin
  if (select kind from public.missions where number = 3097) is distinct from 'omni-bugs'
     or (select (state, attempts) from public.omni_bug_reports where fingerprint = '3088308830883088000000000000000000000000000000000000000000000000')
        is distinct from ('fixed'::text, 3::smallint) then
    raise exception 'FAIL: running the migration again changed a row';
  end if;
end $$;

rollback;
