-- The PRD list loads at a real workspace's size (bug #1308). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/dossier_list_volume.sql
-- /prd reads dossier_list() whole, as the signed-in member. Production gives that role an 8 second
-- statement timeout; past it the page says "The dossier database could not answer". A workspace of
-- 1400 dossiers, six versions each, two ask sessions each (its Claude session's and its delivery's)
-- and nine answered rounds per session must be listed, every dossier once, inside that timeout.
-- One transaction, rolled back at the end. Any `FAIL:` or a cancelled statement stops the run.

begin;

-- The fixture is written as the database owner, without the tables' guards: they check who writes,
-- which is not what this check is about.
set local session_replication_role = replica;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
insert into public.workspace_members (workspace_id, user_id)
select w.id, '00000000-0000-4000-8000-0000000000a1' from public.workspaces w where w.slug = 'vertuoza';

-- 1400 numbered dossiers, each opened in its own Claude session: PRDs, bug fixes and visual fixes.
insert into public.dossiers (workspace_id, home_repo, prd, kind, title, opened_by, claude_session_id, created_at, numbered_at)
select w.id, 'vertuoza/vertuo-omni-loop', g,
       case when g % 10 = 0 then 'bug' when g % 25 = 0 then 'visual' else 'prd' end,
       'Dossier ' || g, '00000000-0000-4000-8000-0000000000a1', 'claude-' || g,
       now() - (1400 - g) * interval '30 minutes', now() - (1400 - g) * interval '30 minutes' + interval '5 minutes'
  from public.workspaces w, generate_series(1, 1400) g
 where w.slug = 'vertuoza';

-- Six versions each.
insert into public.dossier_versions (dossier_id, kind, content, sha256, bytes, source, created_at)
select d.id, (array['spec', 'plan', 'before-after'])[1 + v % 3], 'v' || v, encode(sha256((d.id::text || v)::bytea), 'hex'), 2,
       'kit', d.created_at + v * interval '1 minute'
  from public.dossiers d, generate_series(1, 6) v;

-- Two ask sessions each: the brainstorm's, in the dossier's Claude session, and a delivery session.
insert into public.ask_sessions (owner, title, repo, claude_session_id, workspace_id, created_at)
select '00000000-0000-4000-8000-0000000000a1', 'Session', 'vertuoza/vertuo-omni-loop', s.claude_session_id, d.workspace_id, d.created_at
  from public.dossiers d
  cross join lateral (values (d.claude_session_id), ('delivery-' || d.prd)) s (claude_session_id);

-- Nine answered rounds per session, each on its dossier's PRD.
insert into public.ask_rounds (session_id, questions, answers, answered_via, status, created_at, answered_at, prd, answered_by)
select s.id, '[{"q": "?"}]', '{}', 'page', 'answered', s.created_at + r * interval '1 minute', s.created_at + r * interval '2 minutes',
       substring(s.claude_session_id from '[0-9]+$')::int, '00000000-0000-4000-8000-0000000000a1'
  from public.ask_sessions s, generate_series(1, 9) r
 where s.claude_session_id is not null;

set local session_replication_role = origin;
analyze public.dossiers, public.dossier_versions, public.ask_sessions, public.ask_rounds;

-- ── Ada, a member, reads the list as /prd does, under production's timeout ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local statement_timeout = '8s';
do $$
declare
  listed int;
  asked int;
begin
  select count(*), sum(l.asked) into listed, asked from public.dossier_list() l;
  if listed <> 1400 then
    raise exception 'FAIL: dossier_list() listed % dossiers, not 1400', listed;
  end if;
  if asked <> 1400 * 18 then
    raise exception 'FAIL: dossier_list() counted % rounds, not %', asked, 1400 * 18;
  end if;
end $$;

rollback;
