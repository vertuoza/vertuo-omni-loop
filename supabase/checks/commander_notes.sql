-- The two notebooks (PRD 3107 s4). The supabase workflow runs it on every pull request, after `supabase db start` has applied
-- the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/commander_notes.sql
-- Initech's virtual fleet night-crew runs mission 3401 and has delivered 3402; Acme's virtual fleet day-crew runs 3499. The
-- service role (the App's notebook job) writes a mission line and a fleet line, each citing events of its mission (AC-6,
-- AC-7). A line with no event, an event of another mission, an event that does not exist, an event cited twice, a mission of
-- another fleet, a line over 300 characters or on two lines is refused; a batch is written once. Nobody signed in writes or
-- changes a line. A member reads their fleet's notebooks, and deletes a line as themselves: the record keeps who and when,
-- and a second deletion changes nothing (AC-8). A member of another workspace, an account of no workspace and anon read
-- nothing and delete nothing. A fleet renamed carries its lines, and a deleted account's deletions keep their login. One
-- transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000340a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000340b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000340c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000340e1', 'eve@example.com');
-- Ada owns Initech and signs in with GitHub as ada, Bob is its member; Carl owns Acme; Eve belongs to none.
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('340a1', '00000000-0000-4000-8000-0000000340a1', '{"user_name": "ada"}', 'github');
insert into public.workspaces (slug, name, github_org) values ('acme-notes', 'Acme', 'acme-notes');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',    '00000000-0000-4000-8000-0000000340a1'::uuid, 'owner'),
         ('initech',    '00000000-0000-4000-8000-0000000340b1'::uuid, 'member'),
         ('acme-notes', '00000000-0000-4000-8000-0000000340c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
insert into public.teams (workspace_id, name, label, color, motto, mascot, sort, kind)
select w.id, f.name, f.label, '#7a5cff', '', 'robot', 100, f.kind
  from (values ('initech', 'night-crew', 'Night Crew', 'virtual'),
               ('acme-notes', 'day-crew', 'Day Crew', 'virtual')) as f (slug, name, label, kind)
  join public.workspaces w on w.slug = f.slug;

insert into public.missions (workspace_id, repo, fleet, number, title, goal, scope, status)
select w.id, m.repo, m.fleet, m.number, 'A mission', 'The fleet works.', '{"prds": [2817], "roadmaps": []}', m.status
  from (values ('initech', 'initech/nimbus-plan', 'night-crew', 3401, 'running'), ('initech', 'initech/nimbus-plan', 'night-crew', 3402, 'delivered'),
               ('acme-notes', 'acme-notes/plan', 'day-crew', 3499, 'running'))
       as m (slug, repo, fleet, number, status)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.mission(n integer) returns uuid language sql as $$
  select m.id from public.missions m where m.number = mission.n;
$$;
insert into public.mission_events (mission_id, role, actor, kind, sentence)
select pg_temp.mission(e.n), 'engineer', 'agent', 'dispatched', e.sentence
  from (values (3401, 'Sent PRD 2817 to the runner.'), (3401, 'PRD 2817 is ready.'), (3401, 'QA sent PRD 2817 back.'),
               (3402, 'The e2e suite timed out on the quotes page.'), (3499, 'Acme''s own work.')) as e (n, sentence);

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-notes');
create temporary table events (n integer, sentence text, id uuid);
insert into events select m.number, e.sentence, e.id from public.mission_events e join public.missions m on m.id = e.mission_id;
create temporary table written (name text primary key, id uuid);
grant select on ids, events to anon, authenticated, service_role;
grant select, insert on written to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The events of mission `n`, oldest first.
create function pg_temp.events_of(n integer) returns uuid[] language sql as $$
  select array_agg(e.id order by e.sentence) from events e where e.n = events_of.n;
$$;
-- Runs a statement that must be refused by a check (23514).
create function pg_temp.refused(stmt text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % was written: %', why, stmt;
exception when check_violation then null;
end;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;
grant execute on function pg_temp.refused(text, text), pg_temp.forbidden(text, text), pg_temp.mission(integer), pg_temp.events_of(integer)
  to anon, authenticated, service_role;

-- ── The App writes the lines, each citing events of its mission (AC-6, AC-7) ──
set local role service_role;
do $$
declare
  v uuid := pg_temp.ws('initech');
  ev uuid[] := pg_temp.events_of(3401);
  ended uuid[] := pg_temp.events_of(3402);
  line uuid;
begin
  insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events)
  values (v, 'night-crew', 'mission', pg_temp.mission(3401), '2026-11-19', 1, 'QA sent PRD 2817 back once before it was ready.', ev[1:2])
  returning id into line;
  insert into written values ('mission', line);
  insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events)
  values (v, 'night-crew', 'fleet', pg_temp.mission(3402), '2026-11-20', 1, 'The e2e suite times out on the quotes page.', ended)
  returning id into line;
  insert into written values ('fleet', line);

  -- No event, an event of another mission, one that does not exist, one cited twice: refused.
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, ''No event.'', ''{}'')', v, pg_temp.mission(3401)), 'a line with no event');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, ''Another mission.'', %L)', v, pg_temp.mission(3401), ended), 'a line citing another mission''s event');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, ''Acme.'', %L)', v, pg_temp.mission(3401), pg_temp.events_of(3499)), 'a line citing another workspace''s event');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, ''Nothing.'', %L)', v, pg_temp.mission(3401), array[gen_random_uuid()]), 'a line citing an event that does not exist');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, ''Twice.'', %L)', v, pg_temp.mission(3401), array[ev[1], ev[1]]), 'a line citing one event twice');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, ''Acme''''s mission.'', %L)', v, pg_temp.mission(3499), pg_temp.events_of(3499)), 'a line of another fleet''s mission');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, %L, %L)', v, pg_temp.mission(3401), repeat('a', 301), ev[1:1]), 'a line over 300 characters');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, %L, %L)', v, pg_temp.mission(3401), E'Two\nlines.', ev[1:1]), 'a line on two lines');
  perform pg_temp.refused(format('insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events, deleted_at, deleted_login) values (%L, ''night-crew'', ''mission'', %L, ''2026-11-19'', 2, ''Born deleted.'', %L, now(), ''ada'')', v, pg_temp.mission(3401), ev[1:1]), 'a line written deleted');

  -- A batch is written once: its place is taken.
  begin
    insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events)
    values (v, 'night-crew', 'mission', pg_temp.mission(3401), '2026-11-19', 1, 'A replay.', ev[1:1]);
    raise exception 'FAIL: a batch was written twice';
  exception when unique_violation then null; end;

  -- The App changes no line.
  begin
    update public.commander_notes set line = 'Something else' where id = (select id from written where name = 'mission');
    raise exception 'FAIL: the service role changed a line';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Not even the database's owner changes a line's words.
do $$
begin
  update public.commander_notes set line = 'Something else' where id = (select id from written where name = 'mission');
  raise exception 'FAIL: a line''s words were changed';
exception when insufficient_privilege then null;
end $$;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.commander_notes limit 1; raise exception 'FAIL: anon read a note';
  exception when insufficient_privilege then null; end;
  perform pg_temp.forbidden(format('select public.commander_note_delete(%L)', (select id from written where name = 'mission')), 'anon');
end $$;
reset role;

-- ── A member reads both notebooks, writes none, and deletes a line as themselves (AC-8) ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340b1');
do $$
declare
  v uuid := pg_temp.ws('initech');
  n public.commander_notes;
  again public.commander_notes;
begin
  if (select count(*) from public.commander_notes) <> 2 then
    raise exception 'FAIL: a member did not read their fleet''s two notebooks';
  end if;
  begin
    insert into public.commander_notes (workspace_id, fleet, notebook, mission_id, day, place, line, events)
    values (v, 'night-crew', 'mission', pg_temp.mission(3401), '2026-11-20', 1, 'A member''s line.', pg_temp.events_of(3401));
    raise exception 'FAIL: a member wrote a line';
  exception when insufficient_privilege then null; end;
  begin
    update public.commander_notes set deleted_at = now(), deleted_login = 'bob' where id = (select id from written where name = 'fleet');
    raise exception 'FAIL: a member deleted a line directly';
  exception when insufficient_privilege then null; end;

  n := public.commander_note_delete((select id from written where name = 'fleet'));
  if n.deleted_at is null or n.deleted_by <> '00000000-0000-4000-8000-0000000340b1' or n.deleted_login <> 'bob@example.com'
     or n.line <> 'The e2e suite times out on the quotes page.' then
    raise exception 'FAIL: the deletion was not recorded as Bob''s: %', row_to_json(n);
  end if;
  again := public.commander_note_delete(n.id);
  if again.deleted_at <> n.deleted_at or again.deleted_login <> n.deleted_login then
    raise exception 'FAIL: a second deletion changed the record: %', row_to_json(again);
  end if;
  if (select count(*) from public.commander_notes where deleted_at is null) <> 1 then
    raise exception 'FAIL: the deleted line still reads as kept';
  end if;
  begin
    perform public.commander_note_delete(gen_random_uuid());
    raise exception 'FAIL: a line that does not exist was deleted';
  exception when invalid_parameter_value then null; end;
end $$;

-- A stranger reads nothing and deletes nothing; neither does an account of no workspace.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340c1');
do $$
begin
  if exists (select 1 from public.commander_notes) then
    raise exception 'FAIL: another workspace''s owner read Initech''s notebooks';
  end if;
  perform pg_temp.forbidden(format('select public.commander_note_delete(%L)', (select id from written where name = 'mission')), 'another workspace''s owner');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340e1');
do $$
begin
  if exists (select 1 from public.commander_notes) then
    raise exception 'FAIL: an account of no workspace read a notebook';
  end if;
  perform pg_temp.forbidden(format('select public.commander_note_delete(%L)', (select id from written where name = 'mission')), 'an account of no workspace');
end $$;
reset role;

do $$
begin
  if (select deleted_at from public.commander_notes where id = (select id from written where name = 'mission')) is not null then
    raise exception 'FAIL: a stranger''s deletion was kept';
  end if;
  -- A fleet renamed carries its lines; a deleted account's deletions keep their login (L-GDPR-3).
  update public.teams set name = 'night-owls' where name = 'night-crew' and workspace_id = pg_temp.ws('initech');
  if (select count(*) from public.commander_notes where fleet = 'night-owls') <> 2 then
    raise exception 'FAIL: a renamed fleet lost its lines';
  end if;
  delete from auth.users where id = '00000000-0000-4000-8000-0000000340b1';
  if (select deleted_login from public.commander_notes where id = (select id from written where name = 'fleet')) is distinct from 'bob@example.com'
     or (select deleted_by from public.commander_notes where id = (select id from written where name = 'fleet')) is not null then
    raise exception 'FAIL: a deleted account''s deletion was not kept by its login alone';
  end if;
end $$;

rollback;
