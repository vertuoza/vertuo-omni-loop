-- Who may read and write the ideas boards (PRD 1246). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/ideas.sql
-- Each rule of the spec's Storage, on realistic rows: a public board is read signed out, a private one
-- reads empty; a second vote by one account is refused; nobody removes someone else's vote; an idea
-- written by a non-member is refused; a vote on a private board is refused. And: a board is off by
-- default, only a member switches it, ideas_board() answers a private board and a missing one the
-- same, counts the votes and never says who voted. One transaction, rolled back at the end. Any
-- `FAIL:` stops the run.

begin;

-- ── The flag is off by default ──
do $$
begin
  if exists (select 1 from public.repositories where public_ideas) then
    raise exception 'FAIL: a repository''s ideas board is public before anyone turned it on';
  end if;
end $$;

-- ── The cast ──
-- Mia is a member of Vertuoza; Vic and Val are signed in with GitHub and belong to no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000012a1', 'mia@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000012b1', 'vic@voters.test', now()),
  ('00000000-0000-4000-8000-0000000012c1', 'val@voters.test', now());
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, '00000000-0000-4000-8000-0000000012a1', 'member' from public.workspaces w where w.slug = 'vertuoza';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
$$;
create temporary table ids (name text primary key, id uuid);
insert into ids select 'vertuoza', w.id from public.workspaces w where w.slug = 'vertuoza';
grant select, insert on ids to anon, authenticated, service_role;
create function pg_temp.id(name text) returns uuid language sql as $$
  select i.id from ids i where i.name = id.name;
$$;
-- Runs a statement that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;

-- ── A member turns omni-loop's board public, and adds three ideas to each board ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000012a1');
do $$
begin
  if not (public.set_repository_public_ideas(pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', true)).public_ideas then
    raise exception 'FAIL: a member could not make the board public';
  end if;
end $$;
with made as (
  insert into public.ideas (workspace_id, repo, title, pitch, lane, prd)
  values (pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', 'A better HUD', 'More useful information in the session HUD.', 'now', null),
         (pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', 'Track our own tokens', 'Switch the token tracking to omni-loop.', 'next', 1246),
         (pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', 'Archived idea', 'Gone from the board.', 'later', null)
  returning id, title
)
insert into ids
select case title when 'A better HUD' then 'public-hud' when 'Track our own tokens' then 'public-tokens' else 'public-archived' end, id from made;
with made as (
  insert into public.ideas (workspace_id, repo, title, pitch)
  values (pg_temp.id('vertuoza'), 'vertuoza/vertuo-apps', 'A private idea', 'Nobody outside reads it.')
  returning id
)
insert into ids select 'private-hud', id from made;
update public.ideas set archived = true where id = pg_temp.id('public-archived');
do $$
begin
  if (select lane from public.ideas where id = pg_temp.id('private-hud')) <> 'later' then
    raise exception 'FAIL: an idea added with no lane is not in later';
  end if;
  if (select added_by from public.ideas where id = pg_temp.id('public-hud')) <> '00000000-0000-4000-8000-0000000012a1' then
    raise exception 'FAIL: an idea does not record who added it';
  end if;
  -- An idea's words are bounded.
  begin
    insert into public.ideas (workspace_id, repo, title, pitch) values (pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', repeat('t', 121), 'p');
    raise exception 'FAIL: a title over 120 characters was stored';
  exception when check_violation then null; end;
  begin
    insert into public.ideas (workspace_id, repo, title, pitch) values (pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', 't', repeat('p', 601));
    raise exception 'FAIL: a pitch over 600 characters was stored';
  exception when check_violation then null; end;
  begin
    insert into public.ideas (workspace_id, repo, title, pitch, lane) values (pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', 't', 'p', 'someday');
    raise exception 'FAIL: a lane other than now, next or later was stored';
  exception when check_violation then null; end;
  -- A member reads a private board through ideas_board() too.
  if (public.ideas_board('vertuoza/vertuo-apps') ->> 'member')::boolean is not true then
    raise exception 'FAIL: a member does not read their own private board';
  end if;
end $$;
reset role;

-- ── Signed out: a public board is read, a private board reads empty ──
set local role anon;
select pg_temp.sign_out();
do $$
declare
  board jsonb;
begin
  if (select count(*) from public.ideas where repo = 'vertuoza/vertuo-omni-loop') <> 3 then
    raise exception 'FAIL: anyone signed out does not read the ideas of a public board';
  end if;
  if exists (select 1 from public.ideas where repo = 'vertuoza/vertuo-apps') then
    raise exception 'FAIL: anyone signed out reads the ideas of a private board';
  end if;
  begin perform 1 from public.idea_votes; raise exception 'FAIL: anon read public.idea_votes';
  exception when insufficient_privilege then null; end;
  board := public.ideas_board('Vertuoza/Vertuo-Omni-Loop');
  if board is null or board ->> 'repo' <> 'vertuoza/vertuo-omni-loop' or not (board ->> 'public')::boolean or (board ->> 'member')::boolean then
    raise exception 'FAIL: ideas_board() does not answer a public board signed out: %', board;
  end if;
  if jsonb_array_length(board -> 'ideas') <> 3
     or (select count(*) from jsonb_array_elements(board -> 'ideas') i where (i ->> 'archived')::boolean and i ->> 'title' = 'Archived idea') <> 1 then
    raise exception 'FAIL: ideas_board() does not mark the archived idea: %', board -> 'ideas';
  end if;
  if public.ideas_board('vertuoza/vertuo-apps') is not null or public.ideas_board('nobody/nothing') is not null then
    raise exception 'FAIL: ideas_board() tells a private board from a missing one';
  end if;
  perform pg_temp.forbidden(format('select public.set_repository_public_ideas(%L, ''vertuoza/vertuo-apps'', true)', pg_temp.id('vertuoza')), 'anon');
  perform pg_temp.forbidden(format('insert into public.ideas (workspace_id, repo, title, pitch) values (%L, ''vertuoza/vertuo-omni-loop'', ''t'', ''p'')', pg_temp.id('vertuoza')), 'anon');
  perform pg_temp.forbidden(format('insert into public.idea_votes (idea_id) values (%L)', pg_temp.id('public-hud')), 'anon');
end $$;
reset role;

-- ── A voter in no workspace: votes once, takes it back, writes no idea, never on a private board ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000012b1');
insert into public.idea_votes (idea_id) values (pg_temp.id('public-hud'));
do $$
declare
  board jsonb;
begin
  -- A second vote by the same account.
  begin
    insert into public.idea_votes (idea_id) values (pg_temp.id('public-hud'));
    raise exception 'FAIL: one account counted two votes on one idea';
  exception when unique_violation then null; end;
  -- A vote cast in someone else's name.
  perform pg_temp.forbidden(format('insert into public.idea_votes (idea_id, user_id) values (%L, ''00000000-0000-4000-8000-0000000012c1'')', pg_temp.id('public-tokens')), 'a voter, for someone else');
  -- A vote on a private board, and on an archived idea.
  perform pg_temp.forbidden(format('insert into public.idea_votes (idea_id) values (%L)', pg_temp.id('private-hud')), 'a voter, on a private board');
  perform pg_temp.forbidden(format('insert into public.idea_votes (idea_id) values (%L)', pg_temp.id('public-archived')), 'a voter, on an archived idea');
  -- An idea written by a non-member: added, changed, archived, or the flag switched.
  perform pg_temp.forbidden(format('insert into public.ideas (workspace_id, repo, title, pitch) values (%L, ''vertuoza/vertuo-omni-loop'', ''t'', ''p'')', pg_temp.id('vertuoza')), 'a non-member');
  perform pg_temp.forbidden(format('select public.set_repository_public_ideas(%L, ''vertuoza/vertuo-omni-loop'', false)', pg_temp.id('vertuoza')), 'a non-member');
  update public.ideas set lane = 'now', title = 'Hijacked', archived = true, prd = 1 where repo = 'vertuoza/vertuo-omni-loop';
  begin delete from public.ideas; raise exception 'FAIL: a non-member could delete an idea';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.ideas where repo = 'vertuoza/vertuo-apps') then
    raise exception 'FAIL: a non-member reads the ideas of a private board';
  end if;
  board := public.ideas_board('vertuoza/vertuo-omni-loop');
  if (select (i ->> 'votes')::int from jsonb_array_elements(board -> 'ideas') i where i ->> 'title' = 'A better HUD') <> 1
     or (select (i ->> 'voted')::boolean from jsonb_array_elements(board -> 'ideas') i where i ->> 'title' = 'A better HUD') is not true
     or (select (i ->> 'voted')::boolean from jsonb_array_elements(board -> 'ideas') i where i ->> 'title' = 'Track our own tokens') is not false then
    raise exception 'FAIL: ideas_board() does not count the vote, or does not mark the voter''s own: %', board -> 'ideas';
  end if;
  if (board -> 'ideas')::text ~ '00000000-0000-4000-8000-0000000012b1' then
    raise exception 'FAIL: ideas_board() says who voted';
  end if;
end $$;
-- Val votes for the HUD too; Vic then takes his own vote back, and cannot take Val's.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000012c1');
insert into public.idea_votes (idea_id) values (pg_temp.id('public-hud'));
do $$
begin
  if (select count(*) from public.idea_votes) <> 1 then
    raise exception 'FAIL: a voter reads someone else''s vote';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000012b1');
delete from public.idea_votes where user_id = '00000000-0000-4000-8000-0000000012c1';
delete from public.idea_votes where idea_id = pg_temp.id('public-hud') and user_id = '00000000-0000-4000-8000-0000000012b1';
do $$
begin
  if (select (i ->> 'votes')::int from jsonb_array_elements(public.ideas_board('vertuoza/vertuo-omni-loop') -> 'ideas') i where i ->> 'title' = 'A better HUD') <> 1 then
    raise exception 'FAIL: taking back a vote did not leave exactly the other voter''s';
  end if;
  begin update public.idea_votes set created_at = now(); raise exception 'FAIL: a voter could change a vote';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$
begin
  if (select count(*) from public.idea_votes where idea_id = pg_temp.id('public-hud') and user_id = '00000000-0000-4000-8000-0000000012c1') <> 1 then
    raise exception 'FAIL: a voter removed someone else''s vote';
  end if;
  if exists (select 1 from public.ideas where title = 'Hijacked' or prd = 1 or (lane = 'now' and title <> 'A better HUD')) then
    raise exception 'FAIL: a non-member changed an idea';
  end if;
  if not (select public_ideas from public.repositories where full_name = 'vertuoza/vertuo-omni-loop') then
    raise exception 'FAIL: a non-member switched the board private';
  end if;
end $$;

-- ── A board turned private again: nothing read, no vote taken or removed ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000012a1');
select public.set_repository_public_ideas(pg_temp.id('vertuoza'), 'vertuoza/vertuo-omni-loop', false);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000012c1');
do $$
begin
  if exists (select 1 from public.ideas) or public.ideas_board('vertuoza/vertuo-omni-loop') is not null then
    raise exception 'FAIL: a board turned private is still read from outside';
  end if;
  perform pg_temp.forbidden(format('insert into public.idea_votes (idea_id) values (%L)', pg_temp.id('public-tokens')), 'a voter, on a board turned private');
  delete from public.idea_votes where idea_id = pg_temp.id('public-hud');
end $$;
reset role;
do $$
begin
  if (select count(*) from public.idea_votes where idea_id = pg_temp.id('public-hud')) <> 1 then
    raise exception 'FAIL: a vote was removed from a private board';
  end if;
end $$;

-- ── One public board per owner/name, whichever workspace lists it ──
do $$
declare
  other uuid;
begin
  insert into public.workspaces (slug, name, github_org) values ('ideas-other', 'Other', 'ideas-other') returning id into other;
  insert into public.repositories (workspace_id, full_name, public_ideas) values (other, 'vertuoza/vertuo-apps', true);
  update public.repositories set public_ideas = true where workspace_id = pg_temp.id('vertuoza') and full_name = 'vertuoza/vertuo-apps';
  raise exception 'FAIL: two workspaces made the same repository''s board public';
exception when unique_violation then null;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.ideas', 'insert') or has_table_privilege('anon', 'public.idea_votes', 'select')
     or has_table_privilege('authenticated', 'public.ideas', 'delete') or has_table_privilege('authenticated', 'public.idea_votes', 'update') then
    raise exception 'FAIL: a grant on the ideas tables is wider than the rules';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.ideas'::regclass)
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public.idea_votes'::regclass) then
    raise exception 'FAIL: row-level security is off on an ideas table';
  end if;
end $$;

rollback;

select 'ideas checks passed' as result;
