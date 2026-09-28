-- Who may read and write the ask sessions (PRD 71, PRD 144). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/ask.sql
-- Accounts each with its own JWT. A session belongs to a workspace: every member of it reads the
-- session and its rounds; only its owner changes it, asks and answers in it, or deletes it; an account
-- of another workspace, or of none, reads nothing. The owner may share a round with a member, who may
-- then answer it while it is open: the first answer wins. Nothing expires: the sweep only closes idle
-- sessions. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- Ask mode's crew is whoever belongs to a workspace (PRD 100). A second workspace, Acme, owns the
-- GitHub organisation acme, and a third, Globex, owns globex and has no member here. Ada joined
-- Vertuoza first, then Acme; Bob belongs to Vertuoza, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme'), ('globex', 'Globex', 'globex');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, m.joined_at
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid, now() - interval '2 days'),
         ('acme',     '00000000-0000-4000-8000-0000000000a1'::uuid, now() - interval '1 day'),
         ('vertuoza', '00000000-0000-4000-8000-0000000000b1'::uuid, now() - interval '1 day'),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid, now() - interval '1 day')
       ) as m (slug, user_id, joined_at)
  join public.workspaces w on w.slug = m.slug;

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

  -- The session's workspace is picked by the database: the one whose GitHub organisation owns the
  -- repo, and otherwise the one Ada joined first.
  if (select w.slug from public.ask_sessions s join public.workspaces w on w.id = s.workspace_id where s.id = sid) <> 'vertuoza' then
    raise exception 'FAIL: a session with no repo did not go to the workspace its owner joined first';
  end if;
  insert into public.ask_sessions (title, repo) values ('acme widgets', 'Acme/widgets') returning id into second;
  if (select w.slug from public.ask_sessions s join public.workspaces w on w.id = s.workspace_id where s.id = second) <> 'acme' then
    raise exception 'FAIL: a session of an acme repo did not go to the workspace of the acme organisation';
  end if;
  insert into ids values ('acme', second);
  insert into public.ask_sessions (title, repo) values ('elsewhere', 'someone-else/tool') returning id into second;
  if (select w.slug from public.ask_sessions s join public.workspaces w on w.id = s.workspace_id where s.id = second) <> 'vertuoza' then
    raise exception 'FAIL: a session of a repo no workspace owns did not go to the workspace its owner joined first';
  end if;
  begin
    insert into public.ask_sessions (title, workspace_id) values ('planted', (select id from public.workspaces where slug = 'acme'));
    raise exception 'FAIL: an account chose the workspace of its session';
  exception when insufficient_privilege then null; end;
  begin
    update public.ask_sessions set workspace_id = (select id from public.workspaces where slug = 'acme') where id = sid;
    raise exception 'FAIL: an account moved its session to another workspace';
  exception when insufficient_privilege then null; end;

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

-- ── Account B (Bob), a member of Ada's workspace who is not the owner: reads, never writes ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  sid constant uuid := (select id from ids where name = 'session');
  rid constant uuid := (select id from ids where name = 'round');
  acme constant uuid := (select id from ids where name = 'acme');
  n int;
begin
  if not exists (select 1 from public.ask_sessions where id = sid) then raise exception 'FAIL: a member did not read a session of their workspace'; end if;
  if (select count(*) from public.ask_rounds where session_id = sid) <> 2 then raise exception 'FAIL: a member did not read the rounds of a session of their workspace'; end if;
  if exists (select 1 from public.ask_sessions where id = acme) then raise exception 'FAIL: a member read a session of a workspace they do not belong to'; end if;

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

  delete from public.ask_sessions where id = sid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: account B deleted account A''s session'; end if;
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

-- ── Account C (Carl), of another workspace: nothing of Ada's Vertuoza sessions ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
declare
  sid constant uuid := (select id from ids where name = 'session');
  rid constant uuid := (select id from ids where name = 'round');
  n int;
begin
  if exists (select 1 from public.ask_sessions s where s.id <> (select id from ids where name = 'acme')) then
    raise exception 'FAIL: an account read a session of another workspace';
  end if;
  if exists (select 1 from public.ask_rounds where session_id = sid) then raise exception 'FAIL: an account read the rounds of another workspace'; end if;
  if (select count(*) from public.ask_sessions where id = (select id from ids where name = 'acme')) <> 1 then
    raise exception 'FAIL: a member of Acme did not read the Acme session';
  end if;
  update public.ask_rounds set status = 'abandoned' where id = rid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: an account of another workspace abandoned a round'; end if;
  delete from public.ask_sessions where id = sid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: an account of another workspace deleted a session'; end if;
end $$;

-- ── Categories (PRD 144, step 3): any member sets one; the model's guess never overrides a person ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  rid constant uuid := (select id from ids where name = 'round');
  second constant uuid := (select id from ids where name = 'second');
begin
  if (select category from public.ask_rounds where id = rid) is not null
     or (select category_by from public.ask_rounds where id = rid) is not null then
    raise exception 'FAIL: a new round was not unsorted';
  end if;
  begin
    update public.ask_rounds set category = 'business' where id = rid;
    raise exception 'FAIL: an owner wrote a category directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.ask_rounds set category_by = 'model' where id = rid;
    raise exception 'FAIL: an owner wrote who set a category directly';
  exception when insufficient_privilege then null; end;

  -- The model's guess, recorded as the owner who asked.
  if not public.ask_round_classified(rid, 'architecture') then raise exception 'FAIL: the model''s guess was not recorded'; end if;
  if (select category || '/' || category_by from public.ask_rounds where id = rid) <> 'architecture/model' then
    raise exception 'FAIL: the model''s guess was not stored as the model''s';
  end if;
  begin
    perform public.ask_round_classified(second, 'design');
    raise exception 'FAIL: a category outside the six was stored';
  exception when check_violation then null; end;
  begin
    perform 1 from public.ask_round_categorize(second, 'design');
    raise exception 'FAIL: a member stored a category outside the six';
  exception when check_violation then null; end;
end $$;

-- Bob, a member who is not the owner, moves it; the model then cannot move it back.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  rid constant uuid := (select id from ids where name = 'round');
  got record;
begin
  select * into got from public.ask_round_categorize(rid, 'product');
  if got.category is distinct from 'product' or got.category_by is distinct from '00000000-0000-4000-8000-0000000000b1' then
    raise exception 'FAIL: a member could not set a round''s category, or it does not say they did';
  end if;
  if public.ask_round_classified(rid, 'business') then raise exception 'FAIL: a member who did not ask recorded the model''s guess'; end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  rid constant uuid := (select id from ids where name = 'round');
begin
  if public.ask_round_classified(rid, 'business') then raise exception 'FAIL: the model''s guess overrode a member''s choice'; end if;
  if (select category || '/' || category_by from public.ask_rounds where id = rid) <> 'product/00000000-0000-4000-8000-0000000000b1' then
    raise exception 'FAIL: a member''s category did not stand';
  end if;
end $$;

-- Carl, of another workspace, cannot touch it; Bob clears it.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
declare
  rid constant uuid := (select id from ids where name = 'round');
begin
  if exists (select 1 from public.ask_round_categorize(rid, 'other')) then
    raise exception 'FAIL: an account of another workspace set a round''s category';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  rid constant uuid := (select id from ids where name = 'round');
  got record;
begin
  select * into got from public.ask_round_categorize(rid, null);
  if got.category is not null or got.category_by is distinct from '00000000-0000-4000-8000-0000000000b1' then
    raise exception 'FAIL: a member could not clear a round''s category';
  end if;
end $$;
reset role;
do $$
begin
  if (select category from public.ask_rounds where id = (select id from ids where name = 'round')) is not null then
    raise exception 'FAIL: an account of another workspace changed a round''s category';
  end if;
  if has_function_privilege('anon', 'public.ask_round_categorize(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.ask_round_classified(uuid, text)', 'execute') then
    raise exception 'FAIL: anon may set a category';
  end if;
  if has_column_privilege('authenticated', 'public.ask_rounds', 'category', 'insert, update')
     or has_column_privilege('authenticated', 'public.ask_rounds', 'category_by', 'insert, update') then
    raise exception 'FAIL: a signed-in account may write a category directly';
  end if;
end $$;
set local role authenticated;

-- ── Signed in, in no workspace: not the crew, so no session at all ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  begin
    insert into public.ask_sessions (title) values ('outsider');
    raise exception 'FAIL: an outsider opened an ask session';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.ask_sessions) <> 0 then raise exception 'FAIL: an outsider read the ask sessions'; end if;
end $$;

-- ── Where a session goes (PRD 459): the repository's owner decides, and membership is the only gate ──
-- Carl belongs to Acme only; Eve to none. Everything this block opens is undone at its end.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
declare
  sid uuid;
begin
  begin
    -- A repository his workspace owns: that workspace.
    insert into public.ask_sessions (title, repo) values ('api', 'acme/api') returning id into sid;
    if (select w.slug from public.ask_sessions s join public.workspaces w on w.id = s.workspace_id where s.id = sid) <> 'acme' then
      raise exception 'FAIL: a member''s session of a repository their workspace owns did not go to it';
    end if;
    -- A repository another workspace owns: refused, naming it.
    begin
      insert into public.ask_sessions (title, repo) values ('web', 'Globex/web');
      raise exception 'FAIL: a session of a repository another workspace owns was opened';
    exception when insufficient_privilege then
      if sqlerrm <> 'you are not a member of Globex, which owns Globex/web' then
        raise exception 'FAIL: the refusal of a repository another workspace owns reads %', sqlerrm;
      end if;
    end;
    -- A repository no workspace owns: the workspace he joined first.
    insert into public.ask_sessions (title, repo) values ('tools', 'nobody/tools') returning id into sid;
    if (select w.slug from public.ask_sessions s join public.workspaces w on w.id = s.workspace_id where s.id = sid) <> 'acme' then
      raise exception 'FAIL: a session of a repository no workspace owns did not go to the workspace its owner joined first';
    end if;
    raise exception 'undo' using errcode = 'U0459';
  exception when sqlstate 'U0459' then null;
  end;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  begin
    insert into public.ask_sessions (title, repo) values ('tools', 'nobody/tools');
    raise exception 'FAIL: an account in no workspace opened a session';
  exception when insufficient_privilege then
    if sqlerrm <> 'no workspace owns nobody/tools yet — install the Omni App' then
      raise exception 'FAIL: the refusal of an account in no workspace reads %', sqlerrm;
    end if;
  end;
  begin
    insert into public.ask_sessions (title, repo) values ('api', 'acme/api');
    raise exception 'FAIL: an account in no workspace opened a session of a repository a workspace owns';
  exception when insufficient_privilege then
    if sqlerrm <> 'you are not a member of Acme, which owns acme/api' then
      raise exception 'FAIL: the refusal of an account in no workspace, for an owned repository, reads %', sqlerrm;
    end if;
  end;
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
    raise exception 'FAIL: account A''s session did not survive accounts B and C';
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
    perform public.ask_sweep();
    raise exception 'FAIL: a signed-in account ran the sweep';
  exception when insufficient_privilege then null; end;

  -- A round never goes on its own.
  begin
    delete from public.ask_rounds where session_id = sid;
    raise exception 'FAIL: a round was deleted on its own';
  exception when insufficient_privilege then null; end;

  -- Only the owner deletes, closed or not: the session and its rounds go for good.
  delete from public.ask_sessions where id = sid;
  if exists (select 1 from public.ask_sessions where id = sid) then raise exception 'FAIL: the owner could not delete their session'; end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.ask_rounds where session_id = (select id from ids where name = 'session')) then
    raise exception 'FAIL: the rounds of a deleted session were kept';
  end if;
end $$;
reset role;

-- ── Sharing (PRD 144, step 4): the owner shares a live round; the first answer wins ──
-- Dan belongs to Vertuoza too, and nothing is shared with him.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'dan@vertuoza.com');
insert into public.workspace_members (workspace_id, user_id)
select id, '00000000-0000-4000-8000-0000000000d1' from public.workspaces where slug = 'vertuoza';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  sid uuid;
  rid uuid;
  bob constant uuid := '00000000-0000-4000-8000-0000000000b1';
  asked constant jsonb := '[{"question": "Which colour?", "header": "Colour", "multiSelect": false,
                             "options": [{"label": "Blue", "description": "calm"}, {"label": "Red", "description": "loud"}]}]';
  label text;
begin
  insert into public.ask_sessions (title) values ('shared questions') returning id into sid;
  -- Five rounds: open and shared (twice), answered and shared, abandoned and shared, open and not shared.
  foreach label in array array['share-open', 'share-open-2', 'share-answered', 'share-abandoned', 'share-none'] loop
    insert into public.ask_rounds (session_id, questions) values (sid, asked) returning id into rid;
    insert into ids values (label, rid);
  end loop;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Blue"}', answered_via = 'page'
   where id = (select id from ids where ids.name = 'share-answered');
  update public.ask_rounds set status = 'abandoned' where id = (select id from ids where ids.name = 'share-abandoned');

  foreach label in array array['share-open', 'share-open-2', 'share-answered', 'share-abandoned'] loop
    if not public.ask_round_share((select id from ids where ids.name = label), bob) then
      raise exception 'FAIL: the owner could not share round % with a member', label;
    end if;
  end loop;
  if not public.ask_round_share((select id from ids where ids.name = 'share-open'), bob) then
    raise exception 'FAIL: sharing a round twice with the same member was refused';
  end if;
  if (select count(*) from public.ask_shares where round_id = (select id from ids where ids.name = 'share-open')) <> 1 then
    raise exception 'FAIL: sharing twice stored two shares';
  end if;
  if (select shared_by from public.ask_shares where round_id = (select id from ids where ids.name = 'share-open')) <> '00000000-0000-4000-8000-0000000000a1' then
    raise exception 'FAIL: a share does not say who shared it';
  end if;
  if public.ask_round_share((select id from ids where ids.name = 'share-none'), '00000000-0000-4000-8000-0000000000c1') then
    raise exception 'FAIL: a round was shared with an account outside the session''s workspace';
  end if;
  if public.ask_round_share((select id from ids where ids.name = 'share-none'), '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: the owner shared a round with themself';
  end if;
  if public.ask_round_share('00000000-0000-4000-8000-00000000ffff', bob) then
    raise exception 'FAIL: a round that does not exist was shared';
  end if;
  begin
    insert into public.ask_shares (round_id, shared_with, shared_by) values ((select id from ids where ids.name = 'share-none'), bob, auth.uid());
    raise exception 'FAIL: a share was written directly';
  exception when insufficient_privilege then null; end;

  -- The members Ada may share with: Vertuoza's, not Acme's.
  if (select array_agg(email order by email) from public.ask_members((select workspace_id from public.ask_sessions where id = sid)))
     <> array['ada@vertuoza.com', 'bob@vertuoza.com', 'dan@vertuoza.com'] then
    raise exception 'FAIL: the members of the workspace are not the ones who belong to it';
  end if;
end $$;

-- Bob, the member it is shared with: answers the open round, and nothing else.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  n int;
begin
  if (select count(*) from public.ask_shares where shared_with = auth.uid()) <> 4 then
    raise exception 'FAIL: a member does not read the rounds shared with them';
  end if;
  if public.ask_round_share((select id from ids where name = 'share-none'), '00000000-0000-4000-8000-0000000000d1') then
    raise exception 'FAIL: a member who is not the owner shared a round';
  end if;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'page'
   where id = (select id from ids where name = 'share-open') and status = 'open';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: a shared member could not answer an open round'; end if;
  if (select answered_by from public.ask_rounds where id = (select id from ids where name = 'share-open')) <> auth.uid() then
    raise exception 'FAIL: the round does not say the shared member answered it';
  end if;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'page'
   where id = (select id from ids where name = 'share-answered');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a shared member answered a round already answered'; end if;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'terminal'
   where id = (select id from ids where name = 'share-abandoned');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a shared member answered a round that moved to the terminal'; end if;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'page'
   where id = (select id from ids where name = 'share-none');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a member answered a round not shared with them'; end if;
  begin
    update public.ask_rounds set status = 'abandoned' where id = (select id from ids where name = 'share-open-2');
    raise exception 'FAIL: a shared member abandoned a round';
  exception when insufficient_privilege then null; end;
  begin
    update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'terminal'
     where id = (select id from ids where name = 'share-open-2');
    raise exception 'FAIL: a shared member answered as the terminal';
  exception when insufficient_privilege then null; end;
end $$;

-- Ada comes second: her answer is not written, and Bob's stands.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  n int;
begin
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Blue"}', answered_via = 'page'
   where id = (select id from ids where name = 'share-open') and status = 'open';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a second answer was written over the first'; end if;
  begin
    update public.ask_rounds set answers = '{"Which colour?": "Blue"}', answered_via = 'page'
     where id = (select id from ids where name = 'share-open');
    raise exception 'FAIL: the owner rewrote a shared member''s answer';
  exception when check_violation then null; end;
  if (select answers ->> 'Which colour?' from public.ask_rounds where id = (select id from ids where name = 'share-open')) <> 'Red' then
    raise exception 'FAIL: the first answer was not kept';
  end if;
end $$;

-- Dan, a member it is not shared with: reads the rounds and their shares, answers nothing.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d1', 'dan@vertuoza.com');
do $$
declare
  n int;
begin
  if not exists (select 1 from public.ask_rounds where id = (select id from ids where name = 'share-open-2')) then
    raise exception 'FAIL: a member did not read a shared round of their workspace';
  end if;
  if (select count(*) from public.ask_shares) <> 4 then raise exception 'FAIL: a member did not read the shares of their workspace''s rounds'; end if;
  update public.ask_rounds set status = 'answered', answers = '{"Which colour?": "Red"}', answered_via = 'page'
   where id = (select id from ids where name = 'share-open-2');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a member who is neither owner nor shared answered a round'; end if;
end $$;

-- Carl, of another workspace: no share, no member of Vertuoza.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.ask_shares) then raise exception 'FAIL: an account of another workspace read a share'; end if;
  if exists (select 1 from public.ask_members((select id from public.workspaces where slug = 'vertuoza'))) then
    raise exception 'FAIL: an account of another workspace listed its members';
  end if;
end $$;
reset role;
do $$
begin
  if has_table_privilege('anon', 'public.ask_shares', 'select, insert, update, delete, truncate') then
    raise exception 'FAIL: anon holds a privilege on the shares';
  end if;
  if has_table_privilege('authenticated', 'public.ask_shares', 'insert, update, delete, truncate') then
    raise exception 'FAIL: a signed-in account may write a share directly';
  end if;
  if has_function_privilege('anon', 'public.ask_round_share(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.ask_members(uuid)', 'execute') then
    raise exception 'FAIL: anon may share a round or list members';
  end if;
end $$;

-- ── The sweep: one scheduled function; it closes idle sessions and deletes nothing ──
do $$
declare
  ledger bigint := (select count(*) from public.ledger_events);
  players bigint := (select count(*) from public.players);
  sessions bigint;
  rounds bigint;
  idle_since constant timestamptz := now() - interval '8 days';
  swept int;
begin
  insert into public.ask_sessions (id, owner, title, status, last_seen_at) values
    ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000000a1', 'closed 8 days ago', 'closed', now() - interval '8 days'),
    ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-0000000000a1', 'idle 8 days', 'open', idle_since),
    ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-0000000000a1', 'idle 11 hours', 'open', now() - interval '11 hours');
  insert into public.ask_rounds (session_id, questions) values
    ('00000000-0000-4000-8000-00000000c001', '[{"question": "old"}]'),
    ('00000000-0000-4000-8000-00000000c003', '[{"question": "old"}]'),
    ('00000000-0000-4000-8000-00000000c004', '[{"question": "recent"}]');
  sessions := (select count(*) from public.ask_sessions);
  rounds := (select count(*) from public.ask_rounds);

  swept := public.ask_sweep();
  if (select count(*) from public.ask_sessions) <> sessions or (select count(*) from public.ask_rounds) <> rounds then
    raise exception 'FAIL: the sweep deleted something';
  end if;
  if (select status from public.ask_sessions where id = '00000000-0000-4000-8000-00000000c001') <> 'closed' then
    raise exception 'FAIL: a session closed 8 days ago was not kept as it was';
  end if;
  if (select status from public.ask_sessions where id = '00000000-0000-4000-8000-00000000c003') <> 'closed' then
    raise exception 'FAIL: the sweep did not close a session idle for 12 hours';
  end if;
  if (select last_seen_at from public.ask_sessions where id = '00000000-0000-4000-8000-00000000c003') <> idle_since + interval '12 hours' then
    raise exception 'FAIL: a swept session is not dated when it read as closed';
  end if;
  if (select status from public.ask_sessions where id = '00000000-0000-4000-8000-00000000c004') <> 'open' then
    raise exception 'FAIL: the sweep closed a session idle for less than 12 hours';
  end if;
  if swept <> 1 then raise exception 'FAIL: the sweep reported % sessions closed, not 1', swept; end if;
  if (select count(*) from public.ledger_events) <> ledger or (select count(*) from public.players) <> players then
    raise exception 'FAIL: the sweep touched the game';
  end if;
  if not exists (select 1 from cron.job where jobname = 'ask-sweep' and command like '%public.ask_sweep()%') then
    raise exception 'FAIL: the sweep is not scheduled';
  end if;
  if exists (select 1 from cron.job where jobname = 'ask-expire') or to_regprocedure('public.ask_expire()') is not null then
    raise exception 'FAIL: the expiry that deleted sessions is still there';
  end if;
  if has_function_privilege('anon', 'public.ask_sweep()', 'execute')
     or has_function_privilege('authenticated', 'public.ask_sweep()', 'execute') then
    raise exception 'FAIL: the API roles may run the sweep';
  end if;
  if has_function_privilege('anon', 'public.repo_workspace(uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.repo_workspace(uuid, text)', 'execute') then
    raise exception 'FAIL: the API roles may call the workspace picker';
  end if;
  if to_regprocedure('public.ask_session_workspace(uuid, text)') is not null then
    raise exception 'FAIL: the picker that sent a repository another workspace owns to the caller''s first workspace is still there';
  end if;
  if has_table_privilege('anon', 'public.ask_sessions', 'select, insert, update, delete, truncate')
     or has_table_privilege('anon', 'public.ask_rounds', 'select, insert, update, delete, truncate') then
    raise exception 'FAIL: anon holds a privilege on the ask tables';
  end if;
  if has_table_privilege('authenticated', 'public.ask_sessions', 'truncate')
     or has_table_privilege('authenticated', 'public.ask_rounds', 'delete, truncate') then
    raise exception 'FAIL: a signed-in account may delete rounds, or truncate the ask tables';
  end if;
  if has_column_privilege('authenticated', 'public.ask_sessions', 'workspace_id', 'insert')
     or has_column_privilege('authenticated', 'public.ask_sessions', 'workspace_id', 'update') then
    raise exception 'FAIL: a signed-in account may write a session''s workspace';
  end if;
end $$;

select 'ask checks passed' as result;
rollback;
