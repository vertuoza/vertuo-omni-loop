-- Message the fleet (PRD 3107 s3). The supabase workflow runs it on every pull request, after `supabase db start` has applied
-- the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/commander_messaged.sql
-- Initech's virtual fleet night-crew runs two missions and has a third, delivered; Acme's virtual fleet day-crew runs one. A
-- member messages their fleet as themselves, signed by their login (AC-5): the message is stored, and a `messaged` event is
-- added to each running mission of the fleet and to no other, linking to the message and holding none of its words. A member
-- of another workspace, an account of no workspace and anon are refused, read nothing and write nothing; so are a fleet that
-- is not virtual and an empty or long message. Nobody signed in writes the tables directly, and nothing is changed once
-- written. A job's claim carries the messages its mission was told that its role had not read, once: the next job of the
-- same role gets none of them, a job of another role gets them, a message sent later reaches the next job, and a claim asked
-- twice answers the same messages. A member reads who read their fleet's messages and nobody else does. The hourly purge
-- deletes what is older than 90 days with its events and receipts (L-GDPR-4), and a deleted account's messages go with it
-- (L-GDPR-3). One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000320a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000320b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000320c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000320e1', 'eve@example.com');
-- Ada owns Initech and signs in with GitHub as ada, Bob is its member and has only an email; Carl owns Acme; Eve belongs to none.
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('320a1', '00000000-0000-4000-8000-0000000320a1', '{"user_name": "ada"}', 'github');
insert into public.workspaces (slug, name, github_org) values ('acme-messaged', 'Acme', 'acme-messaged');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',       '00000000-0000-4000-8000-0000000320a1'::uuid, 'owner'),
         ('initech',       '00000000-0000-4000-8000-0000000320b1'::uuid, 'member'),
         ('acme-messaged', '00000000-0000-4000-8000-0000000320c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
insert into public.teams (workspace_id, name, label, color, motto, mascot, sort, kind)
select w.id, f.name, f.label, '#7a5cff', '', 'robot', 100, f.kind
  from (values ('initech', 'night-crew', 'Night Crew', 'virtual'),
               ('acme-messaged', 'day-crew', 'Day Crew', 'virtual')) as f (slug, name, label, kind)
  join public.workspaces w on w.slug = f.slug;

-- Initech's night-crew runs missions 3201 and 3202 and has delivered 3203; Acme's day-crew runs mission 3299.
insert into public.missions (workspace_id, repo, fleet, number, title, goal, scope, status)
select w.id, m.repo, m.fleet, m.number, 'A mission', 'The fleet works.', '{"prds": [2817], "roadmaps": []}', m.status
  from (values ('initech', 'initech/nimbus-plan', 'night-crew', 3201, 'running'), ('initech', 'initech/nimbus-plan', 'night-crew', 3202, 'running'),
               ('initech', 'initech/nimbus-plan', 'night-crew', 3203, 'delivered'), ('acme-messaged', 'acme-messaged/plan', 'day-crew', 3299, 'running'))
       as m (slug, repo, fleet, number, status)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-messaged');
create temporary table sent (name text primary key, id uuid);
grant select on ids to anon, authenticated, service_role;
grant select, insert on sent to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
create function pg_temp.mission(n integer) returns uuid language sql as $$
  select m.id from public.missions m where m.number = mission.n;
$$;
-- Runs a call that must be refused for its field: SQLSTATE 22023, the field as its hint, and a message that starts with
-- `word`.
create function pg_temp.refused_for(stmt text, field text, word text) returns void language plpgsql as $$
declare
  msg text;
  h text;
begin
  execute stmt;
  raise exception 'FAIL: % was not refused for its %', stmt, field;
exception when invalid_parameter_value then
  get stacked diagnostics msg = message_text, h = pg_exception_hint;
  if h is distinct from field or msg not like word || '%' then
    raise exception 'FAIL: % was refused without naming its %: % (hint %)', stmt, field, msg, h;
  end if;
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
-- The words a claim carries, as the runner reads them: the messages job `j` carries, oldest first, as author: body.
create function pg_temp.claim(j uuid) returns text[] language sql as $$
  select coalesce(array_agg(c.author_login || ': ' || c.body order by c.created_at, c.id), '{}') from public.commander_claim_messages(j) c;
$$;
grant execute on function pg_temp.refused_for(text, text, text), pg_temp.forbidden(text, text), pg_temp.mission(integer), pg_temp.claim(uuid)
  to anon, authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.fleet_messages limit 1; raise exception 'FAIL: anon read a fleet message';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.fleet_message_reads limit 1; raise exception 'FAIL: anon read a receipt';
  exception when insufficient_privilege then null; end;
  perform pg_temp.forbidden(format('select public.commander_send(%L, ''night-crew'', ''Hello'')', pg_temp.ws('initech')), 'anon');
end $$;
reset role;

-- ── A member messages their fleet, as themselves (AC-5) ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000320b1');
do $$
declare
  v uuid := pg_temp.ws('initech');
  m public.fleet_messages;
begin
  m := public.commander_send(v, 'night-crew', '  The design review moved to Thursday.  ');
  if m.author_id <> '00000000-0000-4000-8000-0000000320b1' or m.body <> 'The design review moved to Thursday.'
     or m.author_login is null or m.fleet <> 'night-crew' or m.workspace_id <> v then
    raise exception 'FAIL: a member''s message was not recorded as theirs: %', row_to_json(m);
  end if;
  insert into sent values ('first', m.id);
  perform pg_temp.refused_for(format('select public.commander_send(%L, ''beaver'', ''Hi'')', v), 'fleet', 'Fleet:');
  perform pg_temp.refused_for(format('select public.commander_send(%L, ''nobody'', ''Hi'')', v), 'fleet', 'Fleet:');
  perform pg_temp.refused_for(format('select public.commander_send(%L, ''night-crew'', ''   '')', v), 'text', 'Message:');
  perform pg_temp.refused_for(format('select public.commander_send(%L, ''night-crew'', %L)', v, repeat('a', 2001)), 'text', 'Message:');
  perform pg_temp.forbidden(format('select public.commander_send(%L, ''day-crew'', ''Hi'')', pg_temp.ws('acme-messaged')), 'a member of another workspace');
  begin
    insert into public.fleet_messages (workspace_id, fleet, author_id, author_login, body)
    values (v, 'night-crew', '00000000-0000-4000-8000-0000000320b1', 'bob', 'Hi');
    raise exception 'FAIL: a signed-in person wrote a fleet message directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.fleet_messages set body = 'Something else' where id = m.id;
    raise exception 'FAIL: a signed-in person changed a fleet message';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence, message_id)
    values (pg_temp.mission(3201), 'supervisor', 'member', 'messaged', 'Sent a message to the fleet.', m.id);
    raise exception 'FAIL: a signed-in person wrote a messaged event directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.fleet_message_reads (message_id, mission_id, role, job_id)
    values (m.id, pg_temp.mission(3201), 'engineer', gen_random_uuid());
    raise exception 'FAIL: a signed-in person wrote a receipt';
  exception when insufficient_privilege then null; end;
  perform pg_temp.forbidden(format('select * from public.commander_claim_messages(%L)', gen_random_uuid()), 'a member');
end $$;
reset role;

-- The event: one per running mission of the fleet, none for a delivered mission or another fleet's, linking to the message
-- and holding none of its words.
do $$
declare
  first_id uuid := (select id from sent where name = 'first');
begin
  if (select count(*) from public.mission_events where kind = 'messaged') <> 2
     or (select count(*) from public.mission_events where kind = 'messaged' and message_id = first_id
                   and mission_id in (pg_temp.mission(3201), pg_temp.mission(3202))) <> 2 then
    raise exception 'FAIL: the message did not reach each running mission of the fleet, and only them';
  end if;
  if exists (select 1 from public.mission_events e
              where e.kind = 'messaged' and (e.actor not in ('member', 'ada') or e.role <> 'supervisor' or e.sentence ilike '%Thursday%' or e.sentence ilike '%design%')) then
    raise exception 'FAIL: a messaged event holds the message''s words, or another actor';
  end if;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence)
    values (pg_temp.mission(3201), 'supervisor', 'member', 'messaged', 'No link.');
    raise exception 'FAIL: a messaged event had no message';
  exception when check_violation then null; end;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence, message_id)
    values (pg_temp.mission(3201), 'supervisor', 'agent', 'paused', 'Paused.', first_id);
    raise exception 'FAIL: another kind of event linked to a message';
  exception when check_violation then null; end;
end $$;

-- A stranger messages nothing, and neither does an account of no workspace.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000320c1');
do $$
begin
  perform pg_temp.forbidden(format('select public.commander_send(%L, ''night-crew'', ''Hi'')', pg_temp.ws('initech')), 'another workspace''s owner');
end $$;
select public.commander_send(pg_temp.ws('acme-messaged'), 'day-crew', 'Acme''s own word.');
select pg_temp.sign_in('00000000-0000-4000-8000-0000000320e1');
do $$
begin
  perform pg_temp.forbidden(format('select public.commander_send(%L, ''night-crew'', ''Hi'')', pg_temp.ws('initech')), 'an account of no workspace');
end $$;
reset role;

-- A fleet with no running mission stores the message and adds no event.
do $$
begin
  update public.missions set status = 'paused' where fleet = 'day-crew';
end $$;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000320c1');
select public.commander_send(pg_temp.ws('acme-messaged'), 'day-crew', 'Nobody runs.');
reset role;
do $$
begin
  if (select count(*) from public.fleet_messages where fleet = 'day-crew') <> 2
     or (select count(*) from public.mission_events where kind = 'messaged' and mission_id = pg_temp.mission(3299)) <> 1 then
    raise exception 'FAIL: a message to a fleet with no running mission was lost, or added an event';
  end if;
end $$;

-- ── The claim: what a job carries, once per role (AC-5) ──
do $$
declare
  ws uuid := pg_temp.ws('initech');
  m1 uuid := pg_temp.mission(3201);
  k text := format('mission:%s:prd:2817:run:', m1);
  a uuid;
  b uuid;
  r uuid;
  c uuid;
  loner uuid;
begin
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:yolo 2817', 'initech/nimbus-plan', 'omni-app', 'night-crew', m1, k || '1') returning id into a;
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:review 2817', 'initech/nimbus-plan', 'omni-app', 'night-crew', m1, k || '1:review:1') returning id into r;
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet)
  values (ws, '/omni:yolo 2900', 'initech/nimbus-plan', 'omni-app', 'night-crew') returning id into loner;
  if public.mission_job_role(k || '1') <> 'engineer' or public.mission_job_role(k || '1:review:2') <> 'reviewer'
     or public.mission_job_role(k || '1:fix:1') <> 'engineer' or public.mission_job_role(k || '1:qa:1') <> 'qa'
     or public.mission_job_role(k || '1:qa-fix:1:3') <> 'engineer' or public.mission_job_role(format('mission:%s:pm:2', m1)) <> 'pm'
     or public.mission_job_role(format('mission:%s:prd:2817:approve:1', m1)) <> 'architect'
     or public.mission_job_role(format('mission:%s:stuck:1', m1)) <> 'supervisor' or public.mission_job_role(null) <> 'supervisor' then
    raise exception 'FAIL: a job''s role was misread from its key';
  end if;

  -- The first Engineer job carries the message with its author, once; asked twice, the same.
  if pg_temp.claim(a) <> array['bob@example.com: The design review moved to Thursday.'] or pg_temp.claim(a) <> array['bob@example.com: The design review moved to Thursday.'] then
    raise exception 'FAIL: the first Engineer job did not carry the message, or not twice alike: %', pg_temp.claim(a);
  end if;
  -- The Reviewer has not read it yet: it carries it too. A job of no mission carries nothing.
  if pg_temp.claim(r) <> array['bob@example.com: The design review moved to Thursday.'] then
    raise exception 'FAIL: another role did not carry the message';
  end if;
  if pg_temp.claim(loner) <> '{}' or pg_temp.claim(gen_random_uuid()) <> '{}' then
    raise exception 'FAIL: a job of no mission, or no job, carried a message';
  end if;

  -- The next Engineer job carries nothing, until another message is sent.
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:yolo 2817', 'initech/nimbus-plan', 'omni-app', 'night-crew', m1, k || '2') returning id into b;
  if pg_temp.claim(b) <> '{}' then
    raise exception 'FAIL: a second job of the same role carried a message it was told already: %', pg_temp.claim(b);
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000320a1', 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.commander_send(ws, 'night-crew', 'And the demo is at ten.');
  reset role;
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:yolo 2817', 'initech/nimbus-plan', 'omni-app', 'night-crew', m1, k || '3') returning id into c;
  if pg_temp.claim(c) <> array['ada: And the demo is at ten.'] then
    raise exception 'FAIL: the next job did not carry the newer message alone: %', pg_temp.claim(c);
  end if;
  -- The other running mission was told both, and its first job carries them in order.
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:yolo 2817', 'initech/nimbus-plan', 'omni-app', 'night-crew', pg_temp.mission(3202), format('mission:%s:prd:2817:run:1', pg_temp.mission(3202)))
  returning id into b;
  if pg_temp.claim(b) <> array['bob@example.com: The design review moved to Thursday.', 'ada: And the demo is at ten.'] then
    raise exception 'FAIL: the other mission''s job did not carry both messages in order: %', pg_temp.claim(b);
  end if;
  -- The delivered mission was told none.
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
  values (ws, '/omni:yolo 2817', 'initech/nimbus-plan', 'omni-app', 'night-crew', pg_temp.mission(3203), format('mission:%s:prd:2817:run:1', pg_temp.mission(3203)))
  returning id into b;
  if pg_temp.claim(b) <> '{}' then
    raise exception 'FAIL: a delivered mission''s job carried a message';
  end if;
  insert into sent values ('engineer-job', a), ('reviewer-job', r);
end $$;

-- ── Who read it, and who may see so ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000320b1');
do $$
declare
  first_id uuid := (select id from sent where name = 'first');
begin
  if (select count(*) from public.fleet_messages) <> 2 then
    raise exception 'FAIL: Initech''s member does not read their fleet''s messages, and only them';
  end if;
  if (select array_agg(x.role || ' ' || (x.job_id = (select id from sent where name = 'engineer-job'))::text order by x.role)
        from public.fleet_message_reads x where x.message_id = first_id and x.mission_id = pg_temp.mission(3201))
     is distinct from array['engineer true', 'reviewer false'] then
    raise exception 'FAIL: the receipts do not name the role and job that read the message';
  end if;
  if (select count(*) from public.fleet_message_reads) <> 5 then
    raise exception 'FAIL: a member does not read all of their workspace''s receipts: %', (select count(*) from public.fleet_message_reads);
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000320c1');
do $$
begin
  if exists (select 1 from public.fleet_messages where workspace_id = pg_temp.ws('initech'))
     or exists (select 1 from public.fleet_message_reads where mission_id = pg_temp.mission(3201)) then
    raise exception 'FAIL: another workspace''s owner read Initech''s messages or receipts';
  end if;
  if (select count(*) from public.fleet_messages) <> 2 then
    raise exception 'FAIL: Acme''s owner does not read their own messages';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000320e1');
do $$
begin
  if exists (select 1 from public.fleet_messages) or exists (select 1 from public.fleet_message_reads) then
    raise exception 'FAIL: an account of no workspace read a message or a receipt';
  end if;
end $$;
reset role;

-- ── Kept 90 days, every hour (L-GDPR-4) ──
do $$
declare
  old uuid;
  v uuid := pg_temp.ws('initech');
begin
  insert into public.fleet_messages (workspace_id, fleet, author_id, author_login, body, created_at)
  values (v, 'night-crew', '00000000-0000-4000-8000-0000000320a1', 'ada', 'An old word', now() - interval '91 days')
  returning id into old;
  insert into public.mission_events (mission_id, role, actor, kind, sentence, message_id)
  values (pg_temp.mission(3201), 'supervisor', 'ada', 'messaged', 'Sent a message to the fleet.', old);
  insert into public.fleet_message_reads (message_id, mission_id, role, job_id)
  values (old, pg_temp.mission(3201), 'engineer', gen_random_uuid());
  insert into public.commander_messages (workspace_id, fleet, kind, author_id, author_login, body, created_at)
  values (v, 'night-crew', 'question', '00000000-0000-4000-8000-0000000320a1', 'ada', 'An old question', now() - interval '91 days');
  if not exists (select 1 from cron.job where jobname = 'commander-messages-forget' and schedule = '17 * * * *') then
    raise exception 'FAIL: no hourly job forgets the Commander''s threads';
  end if;
end $$;
set local role service_role;
do $$
begin
  if public.commander_messages_forget() <> 2 then
    raise exception 'FAIL: the purge did not delete the old message and the old question';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.fleet_messages where workspace_id = pg_temp.ws('initech')) <> 2
     or (select count(*) from public.mission_events where kind = 'messaged' and mission_id = pg_temp.mission(3201)) <> 2 then
    raise exception 'FAIL: the purge deleted a message younger than 90 days, or left the old one''s event';
  end if;
  if exists (select 1 from public.fleet_message_reads where role = 'engineer' and message_id not in (select id from public.fleet_messages)) then
    raise exception 'FAIL: the purge left the old message''s receipt';
  end if;
  -- A deleted account's messages go with it, and their events and receipts (L-GDPR-3).
  delete from auth.users where id = '00000000-0000-4000-8000-0000000320b1';
  if exists (select 1 from public.fleet_messages where author_login = 'bob@example.com')
     or exists (select 1 from public.mission_events where kind = 'messaged' and actor = 'member' and mission_id in (pg_temp.mission(3201), pg_temp.mission(3202)))
     or exists (select 1 from public.fleet_message_reads x where x.message_id = (select id from sent where name = 'first')) then
    raise exception 'FAIL: a deleted account''s message, its events or its receipts stayed: % % %', (select count(*) from public.fleet_messages where author_login = 'bob@example.com'), (select count(*) from public.mission_events where kind = 'messaged' and actor = 'member' and mission_id in (pg_temp.mission(3201), pg_temp.mission(3202))), (select count(*) from public.fleet_message_reads x where x.message_id = (select id from sent where name = 'first'));
  end if;
end $$;

rollback;
