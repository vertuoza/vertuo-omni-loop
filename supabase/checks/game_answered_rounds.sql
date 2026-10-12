-- What the game reads of the answered ask rounds, and who may read it (PRD 1180). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/game_answered_rounds.sql
-- game_answered_rounds(workspace, since) returns only that workspace's rounds answered since `since`,
-- each with its PRD by the brainstorm rule (first) or the delivery rule over numbered PRD dossiers (null
-- when none claims it), its home in lower case (the PRD's, else the round's repository) and the
-- answerer's lower-case login; no round without a login. Only the service role runs it. The ledger takes
-- a QUESTION_ANSWERED row, on planet 0 when it belongs to no PRD, and no other row on planet 0.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Two workspaces, Game and Other. Ada plays in Game with a player login in capitals; Paul has no
-- player row, only a linked GitHub identity; Nell is a member with no login at all; Carl is in Other.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000a0a01', 'ada@game.test',  '{}'),
  ('00000000-0000-4000-8000-0000000a0b01', 'paul@game.test', '{}'),
  ('00000000-0000-4000-8000-0000000a0e01', 'nell@game.test', '{}'),
  ('00000000-0000-4000-8000-0000000a0c01', 'carl@other.test', '{}');
insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000a0b01', 'github', '7101', '{"sub": "7101", "user_name": "PaEtienne"}', now(), now());
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-0000000a0000', 'game-answers', 'Game', 'game'),
  ('00000000-0000-4000-8000-0000000a0100', 'other-answers', 'Other', 'other');
insert into public.workspace_members (workspace_id, user_id, joined_at) values
  ('00000000-0000-4000-8000-0000000a0000', '00000000-0000-4000-8000-0000000a0a01', now()),
  ('00000000-0000-4000-8000-0000000a0000', '00000000-0000-4000-8000-0000000a0b01', now()),
  ('00000000-0000-4000-8000-0000000a0000', '00000000-0000-4000-8000-0000000a0e01', now()),
  ('00000000-0000-4000-8000-0000000a0100', '00000000-0000-4000-8000-0000000a0c01', now());

-- Rows the app writes only through its guards and triggers: written here with the triggers off, as the
-- history they leave.
set local session_replication_role = replica;
insert into public.players (workspace_id, user_id, display_name, hero, github_login) values
  ('00000000-0000-4000-8000-0000000a0000', '00000000-0000-4000-8000-0000000a0a01', 'ADA', '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}', 'Ada-GH');
-- Dossiers of Game: PRD 7 opened in Claude session cs-1 on the 10th, a draft opened in cs-2, PRD 8
-- opened in cs-1 on the 20th (closing PRD 7's brainstorm window), and a fix numbered 9. Other has its
-- own PRD 7 in the same home.
insert into public.dossiers (id, workspace_id, home_repo, prd, kind, title, claude_session_id, created_at, numbered_at) values
  ('00000000-0000-4000-8000-0000000ad007', '00000000-0000-4000-8000-0000000a0000', 'game/plan', 7,    'prd', 'Seven', 'cs-1', '2026-09-10 08:00+00', '2026-09-10 09:00+00'),
  ('00000000-0000-4000-8000-0000000ad0d1', '00000000-0000-4000-8000-0000000a0000', 'game/plan', null, 'prd', 'Draft', 'cs-2', '2026-09-10 08:00+00', null),
  ('00000000-0000-4000-8000-0000000ad008', '00000000-0000-4000-8000-0000000a0000', 'game/plan', 8,    'prd', 'Eight', 'cs-1', '2026-09-20 08:00+00', '2026-09-20 09:00+00'),
  ('00000000-0000-4000-8000-0000000ad009', '00000000-0000-4000-8000-0000000a0000', 'game/plan', 9,    'bug', 'A fix', 'cs-3', '2026-09-10 08:00+00', '2026-09-10 08:00+00'),
  ('00000000-0000-4000-8000-0000000ad107', '00000000-0000-4000-8000-0000000a0100', 'game/plan', 7,    'prd', 'Other seven', null, '2026-09-10 08:00+00', '2026-09-10 08:00+00');
insert into public.ask_sessions (id, owner, title, repo, workspace_id, claude_session_id) values
  ('00000000-0000-4000-8000-0000000a5001', '00000000-0000-4000-8000-0000000a0a01', 'plan · brainstorm', 'Game/Plan', '00000000-0000-4000-8000-0000000a0000', 'cs-1'),
  ('00000000-0000-4000-8000-0000000a5002', '00000000-0000-4000-8000-0000000a0a01', 'other · draft', 'game/other', '00000000-0000-4000-8000-0000000a0000', 'cs-2'),
  ('00000000-0000-4000-8000-0000000a5003', '00000000-0000-4000-8000-0000000a0b01', 'plan · delivery', 'GAME/PLAN', '00000000-0000-4000-8000-0000000a0000', null),
  ('00000000-0000-4000-8000-0000000a5004', '00000000-0000-4000-8000-0000000a0a01', 'fix', 'game/plan', '00000000-0000-4000-8000-0000000a0000', 'cs-3'),
  ('00000000-0000-4000-8000-0000000a5101', '00000000-0000-4000-8000-0000000a0c01', 'other · plan', 'game/plan', '00000000-0000-4000-8000-0000000a0100', null);
insert into public.ask_rounds (id, session_id, questions, answers, answered_via, status, prd, created_at, answered_at, answered_by) values
  -- Returned: brainstorm, in PRD 7's window, by Ada.
  ('00000000-0000-4000-8000-0000000aa001', '00000000-0000-4000-8000-0000000a5001', '[{"question": "Which?"}]', '{"Which?": "A"}', 'terminal', 'answered', null, '2026-09-12 10:00+00', '2026-09-12 10:05+00', '00000000-0000-4000-8000-0000000a0a01'),
  -- Returned as PRD 8: brainstorm (PRD 8's window) wins over delivery (its own prd 7).
  ('00000000-0000-4000-8000-0000000aa002', '00000000-0000-4000-8000-0000000a5001', '[{"question": "Which?"}]', '{"Which?": "A"}', 'page', 'answered', 7, '2026-09-21 10:00+00', '2026-09-21 10:05+00', '00000000-0000-4000-8000-0000000a0b01'),
  -- Returned with no PRD, in its own repository: a brainstorm on a draft.
  ('00000000-0000-4000-8000-0000000aa003', '00000000-0000-4000-8000-0000000a5002', '[{"question": "Which?"}]', '{"Which?": "A"}', 'page', 'answered', null, '2026-09-12 10:00+00', '2026-09-12 10:05+00', '00000000-0000-4000-8000-0000000a0a01'),
  -- Returned: delivery, prd 7 asked in its home repository (in another case), by Paul.
  ('00000000-0000-4000-8000-0000000aa004', '00000000-0000-4000-8000-0000000a5003', '[{"question": "Which?"}]', '{"Which?": "A"}', 'terminal', 'answered', 7, '2026-09-22 10:00+00', '2026-09-22 10:05+00', '00000000-0000-4000-8000-0000000a0b01'),
  -- Returned with no PRD: a PRD no dossier has.
  ('00000000-0000-4000-8000-0000000aa005', '00000000-0000-4000-8000-0000000a5003', '[{"question": "Which?"}]', '{"Which?": "A"}', 'terminal', 'answered', 99, '2026-09-22 10:00+00', '2026-09-22 10:05+00', '00000000-0000-4000-8000-0000000a0b01'),
  -- Not returned: an answerer with no login.
  ('00000000-0000-4000-8000-0000000aa006', '00000000-0000-4000-8000-0000000a5003', '[{"question": "Which?"}]', '{"Which?": "A"}', 'terminal', 'answered', 7, '2026-09-22 11:00+00', '2026-09-22 11:05+00', '00000000-0000-4000-8000-0000000a0e01'),
  -- Not returned: answered before `since`.
  ('00000000-0000-4000-8000-0000000aa007', '00000000-0000-4000-8000-0000000a5003', '[{"question": "Which?"}]', '{"Which?": "A"}', 'terminal', 'answered', 7, '2026-09-01 10:00+00', '2026-09-01 10:05+00', '00000000-0000-4000-8000-0000000a0b01'),
  -- Not returned: still open.
  ('00000000-0000-4000-8000-0000000aa008', '00000000-0000-4000-8000-0000000a5003', '[{"question": "Which?"}]', null, null, 'open', 7, '2026-09-22 12:00+00', null, null),
  -- Returned with no PRD: a fix's brainstorm, which is no PRD.
  ('00000000-0000-4000-8000-0000000aa009', '00000000-0000-4000-8000-0000000a5004', '[{"question": "Which?"}]', '{"Which?": "A"}', 'page', 'answered', null, '2026-09-12 10:00+00', '2026-09-12 10:05+00', '00000000-0000-4000-8000-0000000a0a01'),
  -- Not returned for Game: Other's round on its own PRD 7.
  ('00000000-0000-4000-8000-0000000aa101', '00000000-0000-4000-8000-0000000a5101', '[{"question": "Which?"}]', '{"Which?": "A"}', 'page', 'answered', 7, '2026-09-22 10:00+00', '2026-09-22 10:05+00', '00000000-0000-4000-8000-0000000a0c01');
set local session_replication_role = origin;

-- ── Only the service role runs it ──
do $$
begin
  if has_function_privilege('anon', 'public.game_answered_rounds(uuid, timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.game_answered_rounds(uuid, timestamptz)', 'execute') then
    raise exception 'FAIL: someone other than the service role may read the answered rounds';
  end if;
  if not has_function_privilege('service_role', 'public.game_answered_rounds(uuid, timestamptz)', 'execute') then
    raise exception 'FAIL: the service role cannot read the answered rounds';
  end if;
end $$;

set local role authenticated;
do $$
begin
  perform * from public.game_answered_rounds('00000000-0000-4000-8000-0000000a0000', '2026-09-05');
  raise exception 'FAIL: a signed-in account read the answered rounds';
exception when insufficient_privilege then null;
end $$;
reset role;

set local role anon;
do $$
begin
  perform * from public.game_answered_rounds('00000000-0000-4000-8000-0000000a0000', '2026-09-05');
  raise exception 'FAIL: anon read the answered rounds';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ── The service role reads Game's rounds since the 5th, by both rules ──
set local role service_role;
do $$
declare
  got text;
  want constant text := '00000000-0000-4000-8000-0000000aa001 7 game/plan ada-gh 2026-09-12 10:05:00+00 | '
                     || '00000000-0000-4000-8000-0000000aa003  game/other ada-gh 2026-09-12 10:05:00+00 | '
                     || '00000000-0000-4000-8000-0000000aa009  game/plan ada-gh 2026-09-12 10:05:00+00 | '
                     || '00000000-0000-4000-8000-0000000aa002 8 game/plan paetienne 2026-09-21 10:05:00+00 | '
                     || '00000000-0000-4000-8000-0000000aa004 7 game/plan paetienne 2026-09-22 10:05:00+00 | '
                     || '00000000-0000-4000-8000-0000000aa005  game/plan paetienne 2026-09-22 10:05:00+00';
begin
  set local timezone = 'UTC';
  select string_agg(format('%s %s %s %s %s', r.round_id, r.prd, r.home, r.login, r.answered_at), ' | ' order by r.answered_at, r.round_id)
    into got
    from public.game_answered_rounds('00000000-0000-4000-8000-0000000a0000', '2026-09-05') r;
  if got is distinct from want then
    raise exception 'FAIL: Game''s answered rounds read as [%], not [%]', got, want;
  end if;

  select string_agg(r.round_id::text, ' ' order by r.answered_at, r.round_id) into got
    from public.game_answered_rounds('00000000-0000-4000-8000-0000000a0000', '2026-09-21 10:05+00') r;
  if got is distinct from '00000000-0000-4000-8000-0000000aa002 00000000-0000-4000-8000-0000000aa004 00000000-0000-4000-8000-0000000aa005' then
    raise exception 'FAIL: since the 21st 10:05, Game''s rounds read as [%], not the three answered at or after it', got;
  end if;

  select string_agg(format('%s %s %s', r.round_id, r.prd, r.login), ' | ') into got
    from public.game_answered_rounds('00000000-0000-4000-8000-0000000a0100', '2026-09-05') r;
  -- Carl has neither a player login nor a GitHub identity: Other returns nothing.
  if got is not null then
    raise exception 'FAIL: Other''s answered rounds read as [%], not none (its only answerer has no login)', got;
  end if;
end $$;
reset role;

-- ── The ledger takes a QUESTION_ANSWERED ──
insert into public.ledger_events (workspace_id, id, at, type, planet, home, contributor)
values ('00000000-0000-4000-8000-0000000a0000', 'ask:00000000-0000-4000-8000-0000000aa001:answered', '2026-09-12 10:05+00', 'QUESTION_ANSWERED', 7, 'game/plan', 'ada-gh');
insert into public.ledger_events (workspace_id, id, at, type, planet, home, contributor)
values ('00000000-0000-4000-8000-0000000a0000', 'ask:00000000-0000-4000-8000-0000000aa009:answered', '2026-09-12 10:05+00', 'QUESTION_ANSWERED', 0, 'game/plan', 'ada-gh');
do $$
begin
  insert into public.ledger_events (workspace_id, id, at, type, planet) values ('00000000-0000-4000-8000-0000000a0000', 'planet:0:charted', now(), 'PLANET_CHARTED', 0);
  raise exception 'FAIL: the ledger took planet 0 for an event that is no answer';
exception when check_violation then null;
end $$;
do $$
begin
  insert into public.ledger_events (workspace_id, id, at, type, planet) values ('00000000-0000-4000-8000-0000000a0000', 'x:1:y', now(), 'QUESTION_ASKED', 7);
  raise exception 'FAIL: the ledger took an event type the game does not know';
exception when check_violation then null;
end $$;

rollback;
