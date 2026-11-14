-- Who may read and write the missions (PRD 2842 s2). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/missions.sql
-- Accounts each with its own JWT. mission_push() files mission 2850 of initech/nimbus-plan in the
-- workspace its repository belongs to for the caller: its page, a dossier of kind mission with its
-- mission.md and mission.html as versions, and its row in draft for one of the workspace's Virtual
-- Fleets. A second push of the same files adds nothing; a push by another member that changes the goal
-- updates it and leaves the status as it was. A players' fleet, an unknown or retired one, and a
-- malformed brief or file are refused naming their field; an account of another workspace, of none,
-- or signed out, nothing. A member reads the missions and their events; anyone else nothing; nobody
-- signed in writes the tables directly. The service role writes them; an event is never updated or
-- deleted, but goes with its mission. A runner job's mission_key is unique and keeps its shape; the
-- general dossier push takes no mission. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000028a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000028b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000028c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000028e1', 'eve@example.com');
-- Ada and Bob belong to Initech; Carl to Acme, which owns the GitHub organisation acme-missions; Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme-missions', 'Acme', 'acme-missions');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values
         ('initech',       '00000000-0000-4000-8000-0000000028a1'::uuid),
         ('initech',       '00000000-0000-4000-8000-0000000028b1'::uuid),
         ('acme-missions', '00000000-0000-4000-8000-0000000028c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;
-- Initech's Virtual Fleet NIGHT SHIFT, and a retired one; its players' fleets are the fixture's.
insert into public.teams (workspace_id, name, label, color, sort, kind, retired_at)
select w.id, f.name, f.label, '#8bd450', f.sort, 'virtual', f.retired_at
  from public.workspaces w,
       (values ('night-shift', 'NIGHT SHIFT', 100, null::timestamptz), ('old-shift', 'OLD SHIFT', 110, now())) as f (name, label, sort, retired_at)
 where w.slug = 'initech';
-- Acme's own Virtual Fleet, which Initech's missions may not name.
insert into public.teams (workspace_id, name, label, color, sort, kind)
select w.id, 'acme-shift', 'ACME SHIFT', '#8bd450', 10, 'virtual' from public.workspaces w where w.slug = 'acme-missions';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Mission 2850's brief, its fields overridden by `extra`.
create function pg_temp.brief(extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'fleet', 'night-shift', 'goal', 'Every quote can be paid online, for every customer.',
    'measures', jsonb_build_array(jsonb_build_object('sign', 'Quotes paid online', 'read', 'the payments report, weekly', 'target', 'three in ten')),
    'scope', jsonb_build_object('prds', jsonb_build_array(2803, 2804), 'roadmaps', jsonb_build_array(12)),
    'mandate', jsonb_build_object('parallel', 2)
  ) || extra;
$$;
-- Mission 2850's two files.
create function pg_temp.files(record text default E'---\nmission: 2850\n---\n') returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('kind', 'mission-record', 'content', record),
                           jsonb_build_object('kind', 'brief', 'content', '<!doctype html><title>Paid online</title>'));
$$;
-- Runs a push that must be refused for its field: SQLSTATE 22023 and the field as its hint.
create function pg_temp.refused_for(brief jsonb, files jsonb, field text) returns void language plpgsql as $$
declare
  h text;
begin
  perform public.mission_push('initech/nimbus-plan', 2850, 'Paid online', brief, files);
  raise exception 'FAIL: a push was not refused for its %: %', field, brief;
exception when invalid_parameter_value then
  get stacked diagnostics h = pg_exception_hint;
  if h is distinct from field then
    raise exception 'FAIL: a push was refused for % instead of its %', h, field;
  end if;
end;
$$;

create table pg_temp.ids (name text primary key, id uuid);
grant all on pg_temp.ids to authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.missions limit 1; raise exception 'FAIL: anon read the missions';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.mission_events limit 1; raise exception 'FAIL: anon read the mission events';
  exception when insufficient_privilege then null; end;
  begin
    perform public.mission_push('initech/nimbus-plan', 2850, 'Paid online', pg_temp.brief(), pg_temp.files());
    raise exception 'FAIL: anon pushed a mission';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member pushes the mission: its page and its row, in draft ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028a1');
do $$
declare
  got jsonb;
  m public.missions;
begin
  got := public.mission_push('Initech/Nimbus-Plan', 2850, '  Paid online ', pg_temp.brief(), pg_temp.files());
  if got -> 'added' <> '[{"kind": "mission-record", "version": 1}, {"kind": "brief", "version": 1}]'::jsonb or got -> 'unchanged' <> '[]'::jsonb then
    raise exception 'FAIL: the first push did not add both files: %', got;
  end if;
  if (got #>> '{mission,status}') <> 'draft' or (got #>> '{mission,created}') <> 'true' then
    raise exception 'FAIL: the first push did not create the mission in draft: %', got;
  end if;
  select * into m from public.missions where number = 2850;
  if m.id is null or m.id <> (got #>> '{mission,id}')::uuid then raise exception 'FAIL: the member does not read the mission pushed'; end if;
  if (m.repo, m.fleet, m.title, m.goal, m.status, m.waiting_on, m.started_by, m.next_wake_at)
       is distinct from ('initech/nimbus-plan'::text, 'night-shift'::text, 'Paid online'::text,
                         'Every quote can be paid online, for every customer.'::text, 'draft'::text, null::text, null::uuid, null::timestamptz) then
    raise exception 'FAIL: the mission is not as pushed: %', row(m.*);
  end if;
  if m.measures <> pg_temp.brief() -> 'measures' or m.scope <> pg_temp.brief() -> 'scope' or m.mandate <> '{"parallel": 2}'::jsonb then
    raise exception 'FAIL: the mission''s measures, scope or mandate are not as pushed: %', row(m.*);
  end if;
  if not exists (select 1 from public.dossiers d
                  where d.id = (got ->> 'id')::uuid and d.kind = 'mission' and d.prd = 2850 and d.home_repo = 'initech/nimbus-plan'
                    and d.title = 'Paid online' and d.workspace_id = m.workspace_id and d.numbered_at is not null) then
    raise exception 'FAIL: the mission''s page is not a numbered dossier of kind mission';
  end if;
  if (select array_agg(v.kind order by v.kind) from public.dossier_versions v where v.dossier_id = (got ->> 'id')::uuid)
       <> array['brief', 'mission-record'] then
    raise exception 'FAIL: the mission''s page does not hold its two files';
  end if;
  insert into pg_temp.ids values ('dossier', (got ->> 'id')::uuid), ('mission', m.id);
end $$;

-- ── The same files again: nothing added, nothing changed ──
do $$
declare
  got jsonb;
  before timestamptz := (select updated_at from public.missions where number = 2850);
begin
  got := public.mission_push('initech/nimbus-plan', 2850, 'Paid online', pg_temp.brief(), pg_temp.files());
  if got -> 'added' <> '[]'::jsonb or got -> 'unchanged' <> '["mission-record", "brief"]'::jsonb or (got #>> '{mission,created}') <> 'false' then
    raise exception 'FAIL: a second push of the same files added something: %', got;
  end if;
  if (select count(*) from public.dossier_versions v where v.dossier_id = (select id from pg_temp.ids where name = 'dossier')) <> 2 then
    raise exception 'FAIL: a second push of the same files added a version';
  end if;
  if (select updated_at from public.missions where number = 2850) <> before then
    raise exception 'FAIL: a second push of the same brief touched the mission';
  end if;
end $$;
reset role;

-- The supervisor's state, as the service role writes it: a push leaves it alone.
set local role service_role;
update public.missions set status = 'running', started_by = '00000000-0000-4000-8000-0000000028a1',
       next_wake_at = now() + interval '1 minute' where number = 2850;
reset role;

-- ── Another member changes the goal: the brief moves, the status stays ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028b1');
do $$
declare
  got jsonb;
  m public.missions;
begin
  got := public.mission_push('initech/nimbus-plan', 2850, 'Paid online', pg_temp.brief('{"goal": "Every quote is paid online."}'),
                             pg_temp.files(E'---\nmission: 2850\ngoal: Every quote is paid online.\n---\n'));
  if got -> 'added' <> '[{"kind": "mission-record", "version": 2}]'::jsonb or (got ->> 'id')::uuid <> (select id from pg_temp.ids where name = 'dossier') then
    raise exception 'FAIL: a changed mission.md was not added to the same page: %', got;
  end if;
  select * into m from public.missions where number = 2850;
  if m.goal <> 'Every quote is paid online.' or m.status <> 'running' or m.started_by is null or m.next_wake_at is null then
    raise exception 'FAIL: a push did not update the goal alone: %', row(m.*);
  end if;
  -- No measure yet, and the default mandate: a one-line mission's brief.
  perform public.mission_push('initech/nimbus-plan', 2851, 'Dark mode', jsonb_build_object('fleet', 'night-shift', 'goal', 'Dark mode for quotes on site.',
                              'scope', jsonb_build_object('prds', jsonb_build_array(2803), 'roadmaps', jsonb_build_array())), pg_temp.files());
  if (select (measures, mandate) from public.missions where number = 2851) is distinct from ('[]'::jsonb, '{"parallel": 2}'::jsonb) then
    raise exception 'FAIL: a brief with no measure and no mandate did not read as none and the default';
  end if;
end $$;

-- ── A wrong fleet, brief or file: refused for its field, nothing written ──
do $$
declare
  versions integer := (select count(*) from public.dossier_versions);
  missions integer := (select count(*) from public.missions);
begin
  perform pg_temp.refused_for(pg_temp.brief('{"fleet": "beaver"}'), pg_temp.files(), 'fleet');
  perform pg_temp.refused_for(pg_temp.brief('{"fleet": "old-shift"}'), pg_temp.files(), 'fleet');
  perform pg_temp.refused_for(pg_temp.brief('{"fleet": "acme-shift"}'), pg_temp.files(), 'fleet');
  perform pg_temp.refused_for(pg_temp.brief() - 'fleet', pg_temp.files(), 'fleet');
  perform pg_temp.refused_for(pg_temp.brief('{"goal": " "}'), pg_temp.files(), 'goal');
  perform pg_temp.refused_for(pg_temp.brief(jsonb_build_object('measures', (select jsonb_agg(pg_temp.brief() #> '{measures,0}') from generate_series(1, 6)))),
                              pg_temp.files(), 'measures');
  perform pg_temp.refused_for(pg_temp.brief('{"measures": [{"sign": "Paid", "read": "weekly"}]}'), pg_temp.files(), 'measures');
  perform pg_temp.refused_for(pg_temp.brief('{"measures": [{"sign": "Paid", "read": "weekly", "target": ""}]}'), pg_temp.files(), 'measures');
  perform pg_temp.refused_for(pg_temp.brief('{"scope": {"prds": [], "roadmaps": []}}'), pg_temp.files(), 'scope');
  perform pg_temp.refused_for(pg_temp.brief('{"scope": {"prds": [2803, 2803], "roadmaps": []}}'), pg_temp.files(), 'scope');
  perform pg_temp.refused_for(pg_temp.brief('{"scope": {"prds": [0], "roadmaps": []}}'), pg_temp.files(), 'scope');
  perform pg_temp.refused_for(pg_temp.brief('{"scope": {"prds": ["2803"], "roadmaps": []}}'), pg_temp.files(), 'scope');
  perform pg_temp.refused_for(pg_temp.brief('{"scope": {"prds": [2803]}}'), pg_temp.files(), 'scope');
  perform pg_temp.refused_for(pg_temp.brief('{"mandate": {"parallel": 5}}'), pg_temp.files(), 'mandate');
  perform pg_temp.refused_for(pg_temp.brief('{"mandate": {}}'), pg_temp.files(), 'mandate');
  perform pg_temp.refused_for(pg_temp.brief(), '[{"kind": "brief", "content": "<p>"}]'::jsonb, 'artifacts');
  perform pg_temp.refused_for(pg_temp.brief(), pg_temp.files() || '[{"kind": "spec", "content": "# Spec"}]'::jsonb, 'artifacts');
  perform pg_temp.refused_for(pg_temp.brief(), pg_temp.files() || pg_temp.files(), 'artifacts');
  if (select count(*) from public.dossier_versions) <> versions or (select count(*) from public.missions) <> missions then
    raise exception 'FAIL: a refused push wrote something';
  end if;
  -- The general push takes no mission: its page is mission_push()'s alone.
  begin
    perform public.dossier_push('initech/nimbus-plan', 2852, 'Another', null, pg_temp.files(), 'mission');
    raise exception 'FAIL: dossier_push() made a mission''s page';
  exception when invalid_parameter_value then null; end;
end $$;

-- ── Nobody signed in writes the tables directly ──
do $$
begin
  begin
    insert into public.missions (workspace_id, repo, fleet, number, title, goal, scope)
    select workspace_id, repo, fleet, 2899, 'x', 'x', scope from public.missions where number = 2850;
    raise exception 'FAIL: a member inserted a mission';
  exception when insufficient_privilege then null; end;
  begin
    update public.missions set status = 'delivered' where number = 2850;
    raise exception 'FAIL: a member updated a mission';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.missions where number = 2850;
    raise exception 'FAIL: a member deleted a mission';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence)
    values ((select id from pg_temp.ids where name = 'mission'), 'supervisor', 'agent', 'started', 'Started.');
    raise exception 'FAIL: a member inserted a mission event';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The service role records events; none is ever changed or deleted ──
set local role service_role;
do $$
declare
  mission uuid := (select id from pg_temp.ids where name = 'mission');
begin
  insert into public.mission_events (mission_id, role, actor, kind, prd, sentence) values
    (mission, 'pm', '00000000ada', 'started', null, 'Started by a member.'),
    (mission, 'supervisor', 'agent', 'dispatched', 2803, 'Sent /omni:yolo 2803 to NIGHT SHIFT.');
  begin
    update public.mission_events set sentence = 'Rewritten.' where mission_id = mission;
    raise exception 'FAIL: the service role updated a mission event';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (mission, 'lead', 'agent', 'started', 'x');
    raise exception 'FAIL: an event took a role that is none of the six';
  exception when check_violation then null; end;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (mission, 'supervisor', 'agent', 'merged', 'x');
    raise exception 'FAIL: an event took a kind that is none of the eleven';
  exception when check_violation then null; end;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (mission, 'supervisor', 'Ada Lovelace', 'started', 'x');
    raise exception 'FAIL: an event was signed by neither an agent nor a login';
  exception when check_violation then null; end;
  begin
    insert into public.missions (workspace_id, repo, fleet, number, title, goal, scope, mandate)
    select workspace_id, repo, fleet, 2898, 'x', 'x', scope, '{}'::jsonb from public.missions where number = 2850;
    raise exception 'FAIL: a mission took an empty mandate';
  exception when check_violation then null; end;
  begin
    update public.missions set status = 'lost' where id = mission;
    raise exception 'FAIL: a mission took a status that is none of the six';
  exception when check_violation then null; end;
end $$;

-- ── The jobs a mission sent: one per key, a key of its shape ──
do $$
declare
  mission uuid := (select id from pg_temp.ids where name = 'mission');
  ws uuid := (select workspace_id from public.missions where id = mission);
  key text := format('mission:%s:prd:2803:run:1', mission);
begin
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:yolo 2803', 'initech/nimbus-plan', 'omni-app', 'night-shift', mission, key);
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
    values (ws, '/omni:yolo 2803', 'initech/nimbus-plan', 'omni-app', 'night-shift', mission, key);
    raise exception 'FAIL: a second job took the same mission_key';
  exception when unique_violation then null; end;
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:yolo 2803', 'initech/nimbus-plan', 'omni-app', 'night-shift', mission, format('mission:%s:prd:2803:run:2', mission));
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
    values (ws, '/omni:yolo 2804', 'initech/nimbus-plan', 'omni-app', mission, 'run-2804');
    raise exception 'FAIL: a job took a mission_key out of its shape';
  exception when check_violation then null; end;
end $$;
reset role;

-- ── A member reads the events; another workspace, or none, reads nothing and pushes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028b1');
do $$
begin
  if (select count(*) from public.mission_events) <> 2 then raise exception 'FAIL: a member does not read the mission''s events'; end if;
  if (select count(*) from public.runner_jobs where mission_id is not null) <> 2 then raise exception 'FAIL: a member does not read the mission''s jobs'; end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028c1');
do $$
begin
  if exists (select 1 from public.missions) or exists (select 1 from public.mission_events) then
    raise exception 'FAIL: an account of another workspace read Initech''s missions';
  end if;
  begin
    perform public.mission_push('initech/nimbus-plan', 2850, 'Paid online', pg_temp.brief(), pg_temp.files());
    raise exception 'FAIL: an account of another workspace pushed to Initech''s mission';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000028e1');
do $$
begin
  if exists (select 1 from public.missions) or exists (select 1 from public.mission_events) then
    raise exception 'FAIL: an account of no workspace read the missions';
  end if;
  begin
    perform public.mission_push('initech/nimbus-plan', 2850, 'Paid online', pg_temp.brief(), pg_temp.files());
    raise exception 'FAIL: an account of no workspace pushed a mission';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── An event is never changed or deleted, even by the tables' owner; its mission's deletion takes it ──
do $$
declare
  mission uuid := (select id from pg_temp.ids where name = 'mission');
begin
  begin
    update public.mission_events set sentence = 'Rewritten.' where mission_id = mission;
    raise exception 'FAIL: a mission event was updated';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.mission_events where mission_id = mission;
    raise exception 'FAIL: a mission event was deleted';
  exception when insufficient_privilege then null; end;
  delete from public.missions where id = mission;
  if exists (select 1 from public.mission_events where mission_id = mission) then
    raise exception 'FAIL: a deleted mission left its events';
  end if;
  if exists (select 1 from public.runner_jobs where mission_id = mission) or (select count(*) from public.runner_jobs where mission_key like 'mission:%') <> 2 then
    raise exception 'FAIL: a deleted mission did not let go of its jobs, or took them';
  end if;
end $$;

rollback;
