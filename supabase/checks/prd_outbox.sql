-- Who may read and write the PRD outboxes (PRD 657, s5). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/prd_outbox.sql
-- The service role records and recounts a PRD's open outbox questions. A member reads their own
-- workspace's rows; a member of another workspace, an account in no workspace and anyone signed out
-- read nothing, and nobody signed in writes. One transaction, rolled back at the end. Any `FAIL:` stops
-- the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to Vertuoza, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role records, and recounts in place ──
set local role service_role;
do $$
declare
  vertuoza uuid := (select id from public.workspaces where slug = 'vertuoza');
  acme     uuid := (select id from public.workspaces where slug = 'acme');
begin
  insert into public.prd_outbox (workspace_id, repository, prd, open_questions, waiting) values
    (vertuoza, 'vertuoza/vertuo-omni-loop', 7, 2, '[{"id":"s1-01-a","rank":"high","question":"Which one?"}]'),
    (vertuoza, 'vertuoza/vertuo-omni-loop', 8, 0, '[]'),
    (acme,     'acme/widgets',              3, 1, '[]');

  -- A recount, as the sync, an event or a send writes it: an upsert.
  insert into public.prd_outbox (workspace_id, repository, prd, open_questions, waiting, synced_at)
  values (vertuoza, 'vertuoza/vertuo-omni-loop', 7, 0, '[]', '2026-09-20T09:00:00Z')
  on conflict (workspace_id, repository, prd)
  do update set open_questions = excluded.open_questions, waiting = excluded.waiting, synced_at = excluded.synced_at;
  if (select open_questions from public.prd_outbox where workspace_id = vertuoza and prd = 7) <> 0 then
    raise exception 'FAIL: a recount did not replace the count';
  end if;
  if (select count(*) from public.prd_outbox) <> 3 then
    raise exception 'FAIL: a recount added a row';
  end if;

  begin
    insert into public.prd_outbox (workspace_id, repository, prd, open_questions) values (vertuoza, 'vertuoza/vertuo-omni-loop', 9, -1);
    raise exception 'FAIL: a negative count was stored';
  exception when check_violation then null; end;
  begin
    insert into public.prd_outbox (workspace_id, repository, prd, open_questions) values (vertuoza, 'Vertuoza/Vertuo-Omni-Loop', 9, 1);
    raise exception 'FAIL: a repository was stored in upper case';
  exception when check_violation then null; end;
  begin
    insert into public.prd_outbox (workspace_id, repository, prd, waiting) values (vertuoza, 'vertuoza/vertuo-omni-loop', 9, '{}');
    raise exception 'FAIL: waiting was stored as something else than a list';
  exception when check_violation then null; end;
  begin
    delete from public.prd_outbox;
    raise exception 'FAIL: the service role deleted an outbox';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.prd_outbox limit 1; raise exception 'FAIL: anon read the outboxes';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's rows only, and writes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  if (select count(*) from public.prd_outbox) <> 2 or exists (select 1 from public.prd_outbox where repository = 'acme/widgets') then
    raise exception 'FAIL: a member did not read exactly their workspace''s outboxes';
  end if;
  begin
    insert into public.prd_outbox (workspace_id, repository, prd, open_questions)
    values ((select id from public.workspaces where slug = 'vertuoza'), 'vertuoza/vertuo-omni-loop', 10, 5);
    raise exception 'FAIL: a member recorded an outbox';
  exception when insufficient_privilege then null; end;
  begin
    update public.prd_outbox set open_questions = 9;
    raise exception 'FAIL: a member recounted an outbox';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.prd_outbox;
    raise exception 'FAIL: a member deleted an outbox';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if (select count(*) from public.prd_outbox) <> 1 or exists (select 1 from public.prd_outbox where repository <> 'acme/widgets') then
    raise exception 'FAIL: a member of another workspace read Vertuoza''s outboxes';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.prd_outbox) then
    raise exception 'FAIL: an account in no workspace read an outbox';
  end if;
end $$;
reset role;

-- ── Grants ──
do $$
begin
  if has_table_privilege('authenticated', 'public.prd_outbox', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the signed-in may write the outboxes';
  end if;
  if has_table_privilege('anon', 'public.prd_outbox', 'select, insert, update, delete') then
    raise exception 'FAIL: anon may touch the outboxes';
  end if;
  if has_table_privilege('service_role', 'public.prd_outbox', 'delete, truncate') then
    raise exception 'FAIL: the service role may delete outboxes';
  end if;
end $$;

select 'prd outbox checks passed' as result;
rollback;
