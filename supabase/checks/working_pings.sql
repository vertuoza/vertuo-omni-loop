-- Who may read and write the heartbeats (PRD 757). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/working_pings.sql
-- Accounts each with its own JWT. working_ping() upserts the caller's own row, in the workspace the
-- repository belongs to for them, and resolves its dossier: a draft by its id, a PRD, a visual fix or a
-- bug fix by the repository and the number, null when there is none yet. Another account cannot write
-- that row, and nobody signed in writes the table directly. A member of the workspace reads the row; an
-- account of another workspace, of none, or signed out, nothing. One transaction, rolled back at the
-- end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- Ada and Bob belong to Vertuoza; Carl to Acme, which owns the GitHub organisation acme; Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('vertuoza', '00000000-0000-4000-8000-0000000000b1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

-- Vertuoza's dossiers of vertuoza/vertuo-omni-loop: a draft, PRD 7, visual fix 12 and bug fix 13.
insert into public.dossiers (id, workspace_id, home_repo, kind, prd, title, numbered_at)
select d.id, w.id, 'vertuoza/vertuo-omni-loop', d.kind, d.prd, d.title, case when d.prd is null then null else now() end
  from (values
         ('00000000-0000-4000-8000-00000000d0a1'::uuid, 'prd',    null::integer, 'A draft'),
         ('00000000-0000-4000-8000-00000000d007'::uuid, 'prd',    7,             'Team inbox'),
         ('00000000-0000-4000-8000-00000000d012'::uuid, 'visual', 12,            'Darker sidebar'),
         ('00000000-0000-4000-8000-00000000d013'::uuid, 'bug',    13,            'Empty list')
       ) as d (id, kind, prd, title)
  cross join public.workspaces w where w.slug = 'vertuoza';

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.working_pings limit 1; raise exception 'FAIL: anon read the working pings';
  exception when insufficient_privilege then null; end;
  begin perform public.working_ping('sess-anon', 'vertuoza/vertuo-omni-loop'); raise exception 'FAIL: anon sent a heartbeat';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada's heartbeats: her own row, its dossier resolved ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'vertuoza');
begin
  perform public.working_ping('sess-a', 'Vertuoza/Vertuo-Omni-Loop', 'prd', 7);
  if not exists (
    select 1 from public.working_pings
     where claude_session_id = 'sess-a' and user_id = '00000000-0000-4000-8000-0000000000a1' and workspace_id = ws
       and repo = 'vertuoza/vertuo-omni-loop' and work_kind = 'prd' and work_number = 7
       and dossier_id = '00000000-0000-4000-8000-00000000d007' and ended_at is null) then
    raise exception 'FAIL: a PRD heartbeat was not stored as its owner''s, in the repository''s workspace, with its dossier';
  end if;

  -- The same session again: one row, its work replaced.
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'draft', null, '00000000-0000-4000-8000-00000000d0a1');
  if (select count(*) from public.working_pings where claude_session_id = 'sess-a') <> 1
     or (select dossier_id from public.working_pings where claude_session_id = 'sess-a') <> '00000000-0000-4000-8000-00000000d0a1' then
    raise exception 'FAIL: a draft heartbeat did not upsert the one row with the draft as its dossier';
  end if;
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'visual', 12);
  if (select dossier_id from public.working_pings where claude_session_id = 'sess-a') <> '00000000-0000-4000-8000-00000000d012' then
    raise exception 'FAIL: a visual fix heartbeat did not resolve its dossier';
  end if;
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'bug', 13);
  if (select dossier_id from public.working_pings where claude_session_id = 'sess-a') <> '00000000-0000-4000-8000-00000000d013' then
    raise exception 'FAIL: a bug fix heartbeat did not resolve its dossier';
  end if;
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'prd', 99);
  if (select dossier_id from public.working_pings where claude_session_id = 'sess-a') is not null then
    raise exception 'FAIL: a PRD with no dossier yet resolved to one';
  end if;
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'bug', 12);
  if (select dossier_id from public.working_pings where claude_session_id = 'sess-a') is not null then
    raise exception 'FAIL: a bug fix resolved to the visual fix of the same number';
  end if;
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop');
  if (select dossier_id from public.working_pings where claude_session_id = 'sess-a') is not null
     or (select work_kind from public.working_pings where claude_session_id = 'sess-a') is not null then
    raise exception 'FAIL: a heartbeat with no work kept a dossier';
  end if;

  -- The end is stamped, and keeps the work; the next heartbeat clears it.
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'prd', 7);
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', null, null, null, true);
  if not exists (select 1 from public.working_pings where claude_session_id = 'sess-a' and ended_at is not null
                   and work_kind = 'prd' and dossier_id = '00000000-0000-4000-8000-00000000d007') then
    raise exception 'FAIL: the end was not stamped, or it dropped the work';
  end if;
  perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'prd', 7);
  if (select ended_at from public.working_pings where claude_session_id = 'sess-a') is not null then
    raise exception 'FAIL: a heartbeat after the end did not clear it';
  end if;

  -- Malformed work is refused.
  begin perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'epic', 7); raise exception 'FAIL: an unknown work kind was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', 'prd', null); raise exception 'FAIL: a PRD without a number was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.working_ping('sess-a', 'widgets', 'prd', 7); raise exception 'FAIL: a repository not owner/name was taken';
  exception when invalid_parameter_value then null; end;

  -- Nothing is written but through the function.
  begin
    insert into public.working_pings (claude_session_id, user_id, workspace_id, repo) values ('planted', '00000000-0000-4000-8000-0000000000a1', ws, 'vertuoza/planted');
    raise exception 'FAIL: a signed-in account wrote a heartbeat directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.working_pings set seen_at = now() - interval '1 day' where claude_session_id = 'sess-a';
    raise exception 'FAIL: a signed-in account changed a heartbeat directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.working_pings where claude_session_id = 'sess-a';
    raise exception 'FAIL: a signed-in account deleted a heartbeat directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Bob, of the same workspace: reads Ada's row, cannot write it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
begin
  if not exists (select 1 from public.working_pings where claude_session_id = 'sess-a' and dossier_id = '00000000-0000-4000-8000-00000000d007') then
    raise exception 'FAIL: a member of the workspace did not read a heartbeat of its dossier';
  end if;
  begin
    perform public.working_ping('sess-a', 'vertuoza/vertuo-omni-loop', null, null, null, true);
    raise exception 'FAIL: another account wrote Ada''s heartbeat';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.working_pings where claude_session_id = 'sess-a' and (ended_at is not null or user_id <> '00000000-0000-4000-8000-0000000000a1')) then
    raise exception 'FAIL: a refused heartbeat changed Ada''s row';
  end if;
end $$;

-- ── Carl, of another workspace, and Eve, of none: read nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.working_pings) then raise exception 'FAIL: an account of another workspace read a heartbeat'; end if;
  begin
    perform public.working_ping('sess-a', 'acme/widgets');
    raise exception 'FAIL: an account of another workspace took over Ada''s session';
  exception when insufficient_privilege then null; end;
  -- His own session goes to his own workspace.
  perform public.working_ping('sess-c', 'acme/widgets', 'prd', 7);
  if not exists (select 1 from public.working_pings p join public.workspaces w on w.id = p.workspace_id
                  where p.claude_session_id = 'sess-c' and w.slug = 'acme' and p.dossier_id is null) then
    raise exception 'FAIL: a heartbeat did not go to the workspace of the repository''s organisation';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.working_pings) then raise exception 'FAIL: an account in no workspace read a heartbeat'; end if;
  begin
    perform public.working_ping('sess-e', 'vertuoza/vertuo-omni-loop');
    raise exception 'FAIL: an account in no workspace sent a heartbeat';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada does not read Carl's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  if exists (select 1 from public.working_pings where claude_session_id = 'sess-c') then
    raise exception 'FAIL: a member read a heartbeat of another workspace';
  end if;
end $$;
reset role;

select 'working pings checks passed' as result;
rollback;
