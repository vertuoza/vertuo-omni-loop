-- Who may read and write the ask sessions (PRD 71). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/ask.sql
-- Two accounts, each with its own JWT: neither reads, changes or removes the other's sessions or
-- rounds. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- Ada's session and round ids, shared between the blocks below.
create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.ask_sessions limit 1; raise exception 'FAIL: anon read the ask sessions';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.ask_rounds limit 1; raise exception 'FAIL: anon read the ask rounds';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Account A (Ada) opens a session and asks in it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  sid uuid;
  rid uuid;
  second uuid;
  n int;
  asked constant jsonb := '[{"question": "Which colour?", "header": "Colour", "multiSelect": false,
                             "options": [{"label": "Blue (Recommended)", "description": "calm"}, {"label": "Red", "description": "loud"}]}]';
begin
  insert into public.ask_sessions (title) values ('vertuoza/vertuo-omni-loop · feat/ask-mode') returning id into sid;
  if (select owner from public.ask_sessions where id = sid) <> '00000000-0000-4000-8000-0000000000a1' then
    raise exception 'FAIL: a new session is not owned by the account that opened it';
  end if;
  if (select status from public.ask_sessions where id = sid) <> 'open' then raise exception 'FAIL: a new session is not open'; end if;

  insert into public.ask_rounds (session_id, questions) values (sid, asked) returning id into rid;
  if (select questions from public.ask_rounds where id = rid) <> asked then raise exception 'FAIL: the questions were not stored as given'; end if;
  if (select status from public.ask_rounds where id = rid) <> 'open' then raise exception 'FAIL: a new round is not open'; end if;
  insert into public.ask_rounds (session_id, questions) values (sid, asked) returning id into second;
  insert into ids values ('session', sid), ('round', rid), ('second', second);

  begin
    insert into public.ask_sessions (owner, title) values ('00000000-0000-4000-8000-0000000000b1', 'for bob');
    raise exception 'FAIL: an account opened a session in someone else''s name';
  exception when insufficient_privilege then null; end;
  begin
    update public.ask_rounds set questions = '[{"question": "rewritten"}]' where id = rid;
    raise exception 'FAIL: the questions of a round were rewritten';
  exception when insufficient_privilege then null; end;
  begin
    update public.ask_rounds set status = 'answered', answers = '{"Which colour?": 3}', answered_via = 'page' where id = rid;
    raise exception 'FAIL: an answer that is not text was stored';
  exception when check_violation then null; end;
  begin
    update public.ask_rounds set status = 'answered' where id = rid;
    raise exception 'FAIL: a round was answered without its answers';
  exception when check_violation then null; end;
end $$;

-- ── Account B (Bob), with his own JWT: nothing of Ada's ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  sid constant uuid := (select id from ids where name = 'session');
  rid constant uuid := (select id from ids where name = 'round');
  n int;
begin
  if (select count(*) from public.ask_sessions) <> 0 then raise exception 'FAIL: account B read account A''s sessions'; end if;
  if (select count(*) from public.ask_rounds) <> 0 then raise exception 'FAIL: account B read account A''s rounds'; end if;

  update public.ask_sessions set status = 'closed' where id = sid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: account B closed account A''s session'; end if;
  update public.ask_sessions set last_seen_at = now() where id = sid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: account B kept account A''s session alive'; end if;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'page' where id = rid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: account B answered account A''s round'; end if;
  update public.ask_rounds set status = 'abandoned' where id = rid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: account B abandoned account A''s round'; end if;

  begin
    delete from public.ask_sessions where id = sid;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: account B deleted account A''s session'; end if;
  exception when insufficient_privilege then null; end;
  begin
    delete from public.ask_rounds where id = rid;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: account B deleted account A''s round'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ask_rounds (session_id, questions) values (sid, '[{"question": "planted"}]');
    raise exception 'FAIL: account B asked in account A''s session';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Signed in with another domain: not the crew, so no session at all ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  begin
    insert into public.ask_sessions (title) values ('outsider');
    raise exception 'FAIL: an outsider opened an ask session';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.ask_sessions) <> 0 then raise exception 'FAIL: an outsider read the ask sessions'; end if;
end $$;

-- ── Back to Ada: her rows are intact, and a round only moves forward ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  sid constant uuid := (select id from ids where name = 'session');
  rid constant uuid := (select id from ids where name = 'round');
  second constant uuid := (select id from ids where name = 'second');
begin
  if (select count(*) from public.ask_sessions where id = sid and status = 'open') <> 1 then
    raise exception 'FAIL: account A''s session did not survive account B';
  end if;
  if (select count(*) from public.ask_rounds where session_id = sid and status = 'open') <> 2 then
    raise exception 'FAIL: account A''s rounds did not survive account B';
  end if;

  -- Answered on the page: final, and stamped.
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Blue (Recommended)"}', answered_via = 'page' where id = rid;
  if (select answered_at from public.ask_rounds where id = rid) is null then raise exception 'FAIL: an answer was not stamped'; end if;
  begin
    update public.ask_rounds set answers = '{"Which colour?": "Red"}', answered_via = 'terminal' where id = rid;
    raise exception 'FAIL: an answered round was answered again';
  exception when check_violation then null; end;
  begin
    update public.ask_rounds set status = 'abandoned', answers = null, answered_via = null where id = rid;
    raise exception 'FAIL: an answered round was abandoned';
  exception when check_violation then null; end;

  -- Abandoned by the hook: only the terminal may answer it now.
  update public.ask_rounds set status = 'abandoned' where id = second;
  begin
    update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'page' where id = second;
    raise exception 'FAIL: the page answered a round that moved to the terminal';
  exception when check_violation then null; end;
  begin
    update public.ask_rounds set status = 'open' where id = second;
    raise exception 'FAIL: an abandoned round was reopened';
  exception when check_violation then null; end;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'terminal' where id = second;
  if (select answered_via from public.ask_rounds where id = second) <> 'terminal' then
    raise exception 'FAIL: the terminal could not answer an abandoned round';
  end if;

  -- Closed: stays closed, and takes no new round.
  update public.ask_sessions set status = 'closed' where id = sid;
  begin
    update public.ask_sessions set status = 'open' where id = sid;
    raise exception 'FAIL: a closed session was reopened';
  exception when check_violation then null; end;
  begin
    insert into public.ask_rounds (session_id, questions) values (sid, '[{"question": "late"}]');
    raise exception 'FAIL: a round was asked in a closed session';
  exception when insufficient_privilege then null; end;

  begin
    perform public.ask_expire();
    raise exception 'FAIL: a signed-in account ran the expiry';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The expiry: one scheduled function, the ask tables only ──
do $$
declare
  ledger bigint := (select count(*) from public.ledger_events);
  players bigint := (select count(*) from public.players);
  gone int;
begin
  insert into public.ask_sessions (id, owner, title, status, last_seen_at) values
    ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000000a1', 'closed 8 days ago', 'closed', now() - interval '8 days'),
    ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-0000000000a1', 'closed 6 days ago', 'closed', now() - interval '6 days'),
    ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-0000000000a1', 'idle 8 days', 'open', now() - interval '8 days'),
    ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-0000000000a1', 'idle 7 days', 'open', now() - interval '7 days');
  insert into public.ask_rounds (session_id, questions) values
    ('00000000-0000-4000-8000-00000000c001', '[{"question": "old"}]'),
    ('00000000-0000-4000-8000-00000000c003', '[{"question": "old"}]'),
    ('00000000-0000-4000-8000-00000000c004', '[{"question": "recent"}]');

  gone := public.ask_expire();
  if exists (select 1 from public.ask_sessions where id in ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c003')) then
    raise exception 'FAIL: a session closed more than 7 days ago was kept';
  end if;
  if exists (select 1 from public.ask_rounds where session_id in ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c003')) then
    raise exception 'FAIL: the rounds of an expired session were kept';
  end if;
  -- Idle for 7 days: it read as closed only 6.5 days ago, so it stays a little longer.
  if (select count(*) from public.ask_sessions where id in ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000c004')) <> 2
     or not exists (select 1 from public.ask_rounds where session_id = '00000000-0000-4000-8000-00000000c004') then
    raise exception 'FAIL: the expiry removed a session closed less than 7 days ago';
  end if;
  if gone <> 2 then raise exception 'FAIL: the expiry reported % sessions removed, not 2', gone; end if;
  if (select count(*) from public.ledger_events) <> ledger or (select count(*) from public.players) <> players then
    raise exception 'FAIL: the expiry touched the game';
  end if;
  if not exists (select 1 from cron.job where jobname = 'ask-expire' and command like '%public.ask_expire()%') then
    raise exception 'FAIL: the expiry is not scheduled';
  end if;
  if has_function_privilege('anon', 'public.ask_expire()', 'execute')
     or has_function_privilege('authenticated', 'public.ask_expire()', 'execute') then
    raise exception 'FAIL: the API roles may run the expiry';
  end if;
  if has_table_privilege('anon', 'public.ask_sessions', 'select, insert, update, delete, truncate')
     or has_table_privilege('anon', 'public.ask_rounds', 'select, insert, update, delete, truncate') then
    raise exception 'FAIL: anon holds a privilege on the ask tables';
  end if;
  if has_table_privilege('authenticated', 'public.ask_sessions', 'delete, truncate')
     or has_table_privilege('authenticated', 'public.ask_rounds', 'delete, truncate') then
    raise exception 'FAIL: a signed-in account may delete ask rows';
  end if;
end $$;

select 'ask checks passed' as result;
rollback;
