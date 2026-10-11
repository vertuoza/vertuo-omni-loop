-- Who may join OMNI KART's live grid (PRD #1572). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/kart_grid.sql
-- The grid is the private Realtime channel `kart:<workspace id>`. A player of that workspace with `kart`
-- in their player_xp.unlocked there receives (select) and sends (insert) Broadcast and Presence messages
-- on it, through the policies on realtime.messages and kart_grid_allows(). Refused (RLS, 42501 on a
-- send, nothing read on a receive): a player of another workspace, a player who has not unlocked kart, a
-- signed-in user with no player row, anon, a topic that is not `kart:<uuid>`, and an extension other than
-- broadcast and presence. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Two workspaces. Ada and Bea play in Grid, Ada with kart unlocked, Bea without; Cy plays in Other with
-- kart unlocked; Dan is signed in with no player row.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000157201', 'ada@grid.test', now()),
  ('00000000-0000-4000-8000-000000157202', 'bea@grid.test', now()),
  ('00000000-0000-4000-8000-000000157203', 'cy@other.test', now()),
  ('00000000-0000-4000-8000-000000157204', 'dan@grid.test', now());
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000000157210', 'kart-grid', 'Grid', 'kart-grid'),
  ('00000000-0000-4000-8000-000000157220', 'kart-other', 'Other', 'kart-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000000157210', '00000000-0000-4000-8000-000000157201', 'member'),
  ('00000000-0000-4000-8000-000000157210', '00000000-0000-4000-8000-000000157202', 'member'),
  ('00000000-0000-4000-8000-000000157210', '00000000-0000-4000-8000-000000157204', 'member'),
  ('00000000-0000-4000-8000-000000157220', '00000000-0000-4000-8000-000000157203', 'member');

-- Rows the app writes only through its guards and triggers: written here with the triggers off.
set local session_replication_role = replica;
insert into public.players (workspace_id, user_id, display_name, hero, github_login) values
  ('00000000-0000-4000-8000-000000157210', '00000000-0000-4000-8000-000000157201', 'ADA', '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}', 'Ada-GH'),
  ('00000000-0000-4000-8000-000000157210', '00000000-0000-4000-8000-000000157202', 'BEA', '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}', 'Bea-GH'),
  ('00000000-0000-4000-8000-000000157220', '00000000-0000-4000-8000-000000157203', 'CY',  '{"v":1,"body":"boy","skin":1,"hair":1,"suit":0,"cape":0}', 'Cy-GH');
set local session_replication_role = origin;
insert into public.player_xp (workspace_id, github_login, xp, level, unlocked, computed_at) values
  ('00000000-0000-4000-8000-000000157210', 'ada-gh', 300, 3, '{invaders,kart}', now()),
  ('00000000-0000-4000-8000-000000157210', 'bea-gh', 50,  1, '{invaders}', now()),
  ('00000000-0000-4000-8000-000000157220', 'cy-gh',  300, 3, '{invaders,kart}', now());

-- realtime.messages is partitioned by day: make sure a partition takes today's rows.
do $$
begin
  insert into realtime.messages (topic, extension) values ('kart-grid-probe', 'broadcast');
  delete from realtime.messages where topic = 'kart-grid-probe';
exception when check_violation then
  execute format('create table realtime.messages_kart_grid_check partition of realtime.messages for values from (%L) to (%L)',
    date_trunc('day', now() at time zone 'utc'), date_trunc('day', now() at time zone 'utc') + interval '1 day');
end $$;

-- Two messages already on Grid's topic and one on Other's, to read as each player.
insert into realtime.messages (topic, extension, event, private) values
  ('kart:00000000-0000-4000-8000-000000157210', 'broadcast', 'state', true),
  ('kart:00000000-0000-4000-8000-000000157210', 'presence', 'presence_state', true),
  ('kart:00000000-0000-4000-8000-000000157220', 'broadcast', 'state', true),
  ('room:00000000-0000-4000-8000-000000157210', 'broadcast', 'state', true);

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Sends a message of `ext` on `topic`, as the signed-in caller, the way Realtime checks it: the topic
-- is the one the connection joined.
create function pg_temp.send(topic text, ext text default 'broadcast') returns void language plpgsql as $$
begin
  perform set_config('realtime.topic', topic, true);
  insert into realtime.messages (topic, extension, event, private) values (topic, ext, 'state', true);
end;
$$;
-- How many messages the signed-in caller reads on `topic`, as joined to it; 0 when the table is closed.
create function pg_temp.receives(topic text) returns bigint language plpgsql as $$
begin
  perform set_config('realtime.topic', topic, true);
  return (select count(*) from realtime.messages m where m.topic = receives.topic);
exception when insufficient_privilege then
  return 0;
end;
$$;
-- Runs `stmt`, which must be refused with 42501, as `who`.
create function pg_temp.refused(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when others then
  if sqlstate <> '42501' then
    raise exception 'FAIL: % for % was % (%), not 42501', stmt, who, sqlstate, sqlerrm;
  end if;
end;
$$;

-- ── Ada: a player of Grid with kart unlocked receives and sends on Grid's topic ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-000000157201');
do $$
begin
  if pg_temp.receives('kart:00000000-0000-4000-8000-000000157210') <> 2 then
    raise exception 'FAIL: Ada does not receive Broadcast and Presence on her workspace''s grid';
  end if;
  perform pg_temp.send('kart:00000000-0000-4000-8000-000000157210', 'broadcast');
  perform pg_temp.send('kart:00000000-0000-4000-8000-000000157210', 'presence');
  if not public.kart_grid_allows('kart:00000000-0000-4000-8000-000000157210') then
    raise exception 'FAIL: kart_grid_allows() refused Ada on her workspace''s grid';
  end if;
  -- Another workspace's grid, an extension the grid does not use, and a topic that is no grid.
  if pg_temp.receives('kart:00000000-0000-4000-8000-000000157220') <> 0 then
    raise exception 'FAIL: Ada receives on another workspace''s grid';
  end if;
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157220'')', 'Ada, on another workspace''s grid');
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157210'', ''postgres_changes'')', 'Ada, on another extension');
  perform pg_temp.refused('select pg_temp.send(''room:00000000-0000-4000-8000-000000157210'')', 'Ada, on another kind of topic');
  perform pg_temp.refused('select pg_temp.send(''kart:not-a-workspace'')', 'Ada, on a topic with no workspace');
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157210/x'')', 'Ada, on a longer topic');
  perform pg_temp.refused('select pg_temp.send(''KART:00000000-0000-4000-8000-000000157210'')', 'Ada, on a topic in capitals');
  if pg_temp.receives('room:00000000-0000-4000-8000-000000157210') <> 0 then
    raise exception 'FAIL: Ada receives on a topic that is no grid';
  end if;
end $$;
reset role;

-- ── Bea: a player of Grid who has not unlocked kart ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-000000157202');
do $$
begin
  if pg_temp.receives('kart:00000000-0000-4000-8000-000000157210') <> 0 then
    raise exception 'FAIL: Bea receives on the grid without kart unlocked';
  end if;
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157210'')', 'Bea, without kart');
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157210'', ''presence'')', 'Bea, without kart');
  if public.kart_grid_allows('kart:00000000-0000-4000-8000-000000157210') then
    raise exception 'FAIL: kart_grid_allows() let Bea in without kart';
  end if;
end $$;
reset role;

-- ── Cy: a player of another workspace, kart unlocked there ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-000000157203');
do $$
begin
  if pg_temp.receives('kart:00000000-0000-4000-8000-000000157220') <> 1 then
    raise exception 'FAIL: Cy does not receive on his own workspace''s grid';
  end if;
  if pg_temp.receives('kart:00000000-0000-4000-8000-000000157210') <> 0 then
    raise exception 'FAIL: Cy receives on Grid, a workspace he does not play in';
  end if;
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157210'')', 'Cy, on another workspace''s grid');
  perform pg_temp.send('kart:00000000-0000-4000-8000-000000157220');
end $$;
reset role;

-- ── Dan: signed in, a member of Grid, with no player row ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-000000157204');
do $$
begin
  if pg_temp.receives('kart:00000000-0000-4000-8000-000000157210') <> 0 then
    raise exception 'FAIL: Dan receives on the grid with no player row';
  end if;
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157210'')', 'Dan, with no player row');
end $$;
reset role;

-- ── Anon ──
set local role anon;
do $$
begin
  if pg_temp.receives('kart:00000000-0000-4000-8000-000000157210') <> 0 then
    raise exception 'FAIL: anon receives on a grid';
  end if;
  perform pg_temp.refused('select pg_temp.send(''kart:00000000-0000-4000-8000-000000157210'')', 'anon');
  perform pg_temp.refused('select public.kart_grid_allows(''kart:00000000-0000-4000-8000-000000157210'')', 'anon, calling the rule');
end $$;
reset role;

rollback;

\echo 'kart_grid: every check passed'
