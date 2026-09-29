-- What the dashboards' two reads return, and to whom (PRD 572). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/dashboards.sql
-- workspace_roster(workspace) lists every member of a workspace, with or without a player row, with a
-- name, a lower-case GitHub login, an avatar and a fleet, and never an email; answered_counts(workspace,
-- from, to) counts each member's answered ask rounds in that workspace's sessions only, in [from, to),
-- and returns nothing but counts. Both return nothing to a non-member, and neither runs signed out.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Two workspaces, Dash and Other. Ada has a player row in Dash, in the fleet OCTO, with a GitHub
-- login in capitals; Paul has no player row, only a linked GitHub identity and a full name; Sol plays
-- solo (a player row with no fleet); Carl belongs to Other only; Eve to none.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000d0a1', 'ada@dash.test',  '{"full_name": "Ada Lovelace", "avatar_url": "https://avatars.test/ada.png"}'),
  ('00000000-0000-4000-8000-00000000d0b1', 'paul@dash.test', '{"full_name": "Paul Etienne", "avatar_url": "https://avatars.test/paul.png"}'),
  ('00000000-0000-4000-8000-00000000d051', 'sol@dash.test',  '{}'),
  ('00000000-0000-4000-8000-00000000d0c1', 'carl@other.test', '{"full_name": "Carl"}'),
  ('00000000-0000-4000-8000-00000000d0e1', 'eve@nowhere.test', '{}');
insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000d0b1', 'github', '7001', '{"sub": "7001", "user_name": "PaEtienne"}', now(), now());
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-00000000d000', 'dash', 'Dash', 'dash'),
  ('00000000-0000-4000-8000-00000000d100', 'other', 'Other', 'other');
insert into public.teams (workspace_id, name, label, color, home, sort) values
  ('00000000-0000-4000-8000-00000000d000', 'octo', 'OCTO', '#3355ff', null, 10);
insert into public.workspace_members (workspace_id, user_id, joined_at) values
  ('00000000-0000-4000-8000-00000000d000', '00000000-0000-4000-8000-00000000d0a1', now() - interval '3 days'),
  ('00000000-0000-4000-8000-00000000d000', '00000000-0000-4000-8000-00000000d0b1', now() - interval '2 days'),
  ('00000000-0000-4000-8000-00000000d000', '00000000-0000-4000-8000-00000000d051', now() - interval '1 day'),
  ('00000000-0000-4000-8000-00000000d100', '00000000-0000-4000-8000-00000000d0c1', now() - interval '1 day');

-- Rows the app never writes this way (a player's login is set only from their linked identity, and a
-- round is answered through its guard): written here with the triggers off, as the history they leave.
set local session_replication_role = replica;
insert into public.players (workspace_id, user_id, display_name, team, hero, github_login) values
  ('00000000-0000-4000-8000-00000000d000', '00000000-0000-4000-8000-00000000d0a1', 'ADA', 'octo', '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}', 'Ada-GH'),
  ('00000000-0000-4000-8000-00000000d000', '00000000-0000-4000-8000-00000000d051', 'SOL', null,   '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}', 'sol-gh');
insert into public.ask_sessions (id, owner, title, workspace_id) values
  ('00000000-0000-4000-8000-00000000d5a1', '00000000-0000-4000-8000-00000000d0a1', 'dash · one', '00000000-0000-4000-8000-00000000d000'),
  ('00000000-0000-4000-8000-00000000d5c1', '00000000-0000-4000-8000-00000000d0c1', 'other · one', '00000000-0000-4000-8000-00000000d100');
-- In Dash: Paul answered two rounds in the window and one before it, Ada one, and one round is open.
-- In Other: Paul's answer there (a round shared with him) does not count for Dash.
insert into public.ask_rounds (session_id, questions, answers, answered_via, status, answered_at, answered_by) values
  ('00000000-0000-4000-8000-00000000d5a1', '[{"question": "Which?"}]', '{"Which?": "private answer"}', 'page', 'answered', '2026-09-20 10:00+00', '00000000-0000-4000-8000-00000000d0b1'),
  ('00000000-0000-4000-8000-00000000d5a1', '[{"question": "Which?"}]', '{"Which?": "private answer"}', 'page', 'answered', '2026-09-21 10:00+00', '00000000-0000-4000-8000-00000000d0b1'),
  ('00000000-0000-4000-8000-00000000d5a1', '[{"question": "Which?"}]', '{"Which?": "private answer"}', 'page', 'answered', '2026-09-01 10:00+00', '00000000-0000-4000-8000-00000000d0b1'),
  ('00000000-0000-4000-8000-00000000d5a1', '[{"question": "Which?"}]', '{"Which?": "private answer"}', 'terminal', 'answered', '2026-09-22 10:00+00', '00000000-0000-4000-8000-00000000d0a1'),
  ('00000000-0000-4000-8000-00000000d5a1', '[{"question": "Which?"}]', null, null, 'open', null, null),
  ('00000000-0000-4000-8000-00000000d5c1', '[{"question": "Which?"}]', '{"Which?": "private answer"}', 'page', 'answered', '2026-09-21 12:00+00', '00000000-0000-4000-8000-00000000d0b1');
set local session_replication_role = origin;

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── Neither function says more than its columns ──
do $$
begin
  if exists (select 1 from information_schema.parameters p
               join information_schema.routines r on r.specific_name = p.specific_name
              where r.routine_schema = 'public' and r.routine_name in ('workspace_roster', 'answered_counts')
                and p.parameter_mode = 'OUT'
                and p.parameter_name not in ('user_id', 'name', 'github_login', 'avatar_url', 'fleet', 'answered')) then
    raise exception 'FAIL: workspace_roster or answered_counts returns a column it should not (an email, a question, an answer…)';
  end if;
  if has_function_privilege('anon', 'public.workspace_roster(uuid)', 'execute')
     or has_function_privilege('anon', 'public.answered_counts(uuid, timestamptz, timestamptz)', 'execute') then
    raise exception 'FAIL: anon may run a dashboard read';
  end if;
  if not has_function_privilege('authenticated', 'public.workspace_roster(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.answered_counts(uuid, timestamptz, timestamptz)', 'execute') then
    raise exception 'FAIL: a signed-in member cannot run the dashboard reads';
  end if;
end $$;

-- ── Signed out: neither runs ──
set local role anon;
do $$
begin
  begin
    perform * from public.workspace_roster('00000000-0000-4000-8000-00000000d000');
    raise exception 'FAIL: anon read a workspace''s roster';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.answered_counts('00000000-0000-4000-8000-00000000d000', '2026-09-01', '2026-10-01');
    raise exception 'FAIL: anon read a workspace''s answered counts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member reads every member of their workspace, and the counts of that workspace only ──
set local role authenticated;
do $$
declare
  dash constant uuid := '00000000-0000-4000-8000-00000000d000';
  r record;
  n int;
begin
  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000d0a1', 'ada@dash.test');

  select count(*) into n from public.workspace_roster(dash);
  if n <> 3 then raise exception 'FAIL: the roster lists % members of Dash, not its 3', n; end if;

  select * into r from public.workspace_roster(dash) where user_id = '00000000-0000-4000-8000-00000000d0a1';
  if r.name <> 'ADA' or r.github_login <> 'ada-gh' or r.fleet <> 'octo' or r.avatar_url <> 'https://avatars.test/ada.png' then
    raise exception 'FAIL: Ada reads as % / % / % / %, not ADA / ada-gh / octo / her avatar', r.name, r.github_login, r.fleet, r.avatar_url;
  end if;
  -- Paul, with no player row: the account's full name, the linked identity's login in lower case, no fleet.
  select * into r from public.workspace_roster(dash) where user_id = '00000000-0000-4000-8000-00000000d0b1';
  if r.user_id is null then raise exception 'FAIL: a member with no player row is missing from the roster'; end if;
  if r.name <> 'Paul Etienne' or r.github_login <> 'paetienne' or r.fleet is not null then
    raise exception 'FAIL: Paul reads as % / % / %, not Paul Etienne / paetienne / no fleet', r.name, r.github_login, r.fleet;
  end if;
  select * into r from public.workspace_roster(dash) where user_id = '00000000-0000-4000-8000-00000000d051';
  if r.name <> 'SOL' or r.fleet is not null or r.avatar_url is not null then
    raise exception 'FAIL: Sol (solo, no avatar) reads as % / % / %', r.name, r.fleet, r.avatar_url;
  end if;

  -- Counts in [from, to), in Dash's sessions: Paul 2 (the one before the window and the one in Other
  -- are left out), Ada 1; the open round counts for nobody.
  select coalesce(sum(answered), 0) into n from public.answered_counts(dash, '2026-09-15', '2026-10-01');
  if n <> 3 then raise exception 'FAIL: Dash''s answered counts sum to %, not 3', n; end if;
  select answered into n from public.answered_counts(dash, '2026-09-15', '2026-10-01') where user_id = '00000000-0000-4000-8000-00000000d0b1';
  if n is distinct from 2 then raise exception 'FAIL: Paul answered % rounds in Dash in the window, not 2', n; end if;
  select answered into n from public.answered_counts(dash, '2026-09-15', '2026-10-01') where user_id = '00000000-0000-4000-8000-00000000d0a1';
  if n is distinct from 1 then raise exception 'FAIL: Ada answered % rounds in Dash in the window, not 1', n; end if;
  select count(*) into n from public.answered_counts(dash, '2026-09-22 10:00+00', '2026-10-01');
  if n <> 1 then raise exception 'FAIL: the window does not start at its first instant'; end if;
  select count(*) into n from public.answered_counts(dash, '2026-09-15', '2026-09-22 10:00+00');
  if n <> 1 then raise exception 'FAIL: the window holds its last instant'; end if;

  -- Another workspace: nothing, even one whose sessions hold an answer of a Dash member.
  select count(*) into n from public.workspace_roster('00000000-0000-4000-8000-00000000d100');
  if n <> 0 then raise exception 'FAIL: Ada read % members of a workspace she is not in', n; end if;
  select count(*) into n from public.answered_counts('00000000-0000-4000-8000-00000000d100', '2026-09-01', '2026-10-01');
  if n <> 0 then raise exception 'FAIL: Ada read % answered counts of a workspace she is not in', n; end if;

  -- An account in no workspace: nothing.
  perform pg_temp.sign_in('00000000-0000-4000-8000-00000000d0e1', 'eve@nowhere.test');
  select count(*) into n from public.workspace_roster(dash);
  if n <> 0 then raise exception 'FAIL: a non-member read % members of Dash', n; end if;
  select count(*) into n from public.answered_counts(dash, '2026-09-01', '2026-10-01');
  if n <> 0 then raise exception 'FAIL: a non-member read % answered counts of Dash', n; end if;
end $$;
reset role;

rollback;
