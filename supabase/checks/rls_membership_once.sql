-- Membership is read once per statement, never once per row (bug #1832). The supabase workflow runs it
-- on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/rls_membership_once.sql
-- A policy that calls public.is_member() with a row's column runs it, and its lookup in
-- workspace_members, for every row the statement reads: a member counting a workspace's 10,323 ledger
-- events paid 351 ms and 20,928 buffer reads for it on production, against 7 ms when the workspaces the
-- person belongs to are read once. Who may read and write what is access.sql's and the other checks';
-- this one holds how it is decided. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

-- 1. No policy calls is_member(): each reads the person's workspaces once, through
--    public.my_workspaces(), whose answer does not depend on the row.
do $$
declare
  offenders text;
begin
  select string_agg(format('%s · %s', tablename, policyname), '; ' order by tablename, policyname)
    into offenders
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') ~ 'is_member\(' or coalesce(with_check, '') ~ 'is_member\(');
  if offenders is not null then
    raise exception 'FAIL: these policies read membership once per row (is_member): %', offenders;
  end if;
end $$;

-- 2. A member's count over a workspace's ledger reads membership once: at the size production reached,
--    the statement stays within a buffer budget the per-row check exceeds a hundredfold.
set local session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000018a1', 'rls-once@example.com');
insert into public.workspace_members (workspace_id, user_id)
select w.id, '00000000-0000-4000-8000-0000000018a1' from public.workspaces w where w.slug = 'initech';
insert into public.ledger_events (workspace_id, id, at, type, planet, home, data)
select w.id, 'rls-once:' || g, now() - g * interval '1 minute', 'PLANET_CHARTED', 1 + g % 300, 'initech/nimbus-plan', '{}'::jsonb
  from public.workspaces w, generate_series(1, 10000) g
 where w.slug = 'initech';
set local session_replication_role = origin;
analyze public.ledger_events;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000018a1","role":"authenticated"}', true);

do $$
declare
  plan json;
  buffers bigint;
  counted bigint;
begin
  execute $q$explain (analyze, buffers, format json)
    select count(*) from public.ledger_events
     where workspace_id = (select id from public.workspaces where slug = 'initech')$q$ into plan;
  buffers := (plan -> 0 -> 'Plan' ->> 'Shared Hit Blocks')::bigint + (plan -> 0 -> 'Plan' ->> 'Shared Read Blocks')::bigint;
  select count(*) into counted from public.ledger_events where workspace_id = (select id from public.workspaces where slug = 'initech');
  if counted < 10000 then
    raise exception 'FAIL: the member counts % of their workspace''s ledger events, not every one', counted;
  end if;
  if buffers > 2000 then
    raise exception 'FAIL: a member''s count over 10,000 ledger events read % buffers (at most 2,000): membership is read per row', buffers;
  end if;
end $$;

rollback;
