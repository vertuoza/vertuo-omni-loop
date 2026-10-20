-- Who may read and write the fix facts (PRD 691, s1). Run it after `supabase db start` has applied the
-- migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/fix_facts.sql
-- The service role stores and refreshes what GitHub says of a fix. A member reads their own workspace's
-- rows; a member of another workspace, an account in no workspace and anyone signed out read nothing,
-- and nobody signed in writes. A row goes with its dossier. One transaction, rolled back at the end. Any
-- `FAIL:` stops the run.

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

-- Three fix dossiers: two of Vertuoza's, one of Acme's.
insert into public.dossiers (id, workspace_id, home_repo, kind, prd, title, numbered_at)
select d.id, w.id, d.repo, d.kind, d.prd, d.title, now()
  from (values
         ('00000000-0000-4000-8000-00000000f001'::uuid, 'vertuoza', 'vertuoza/vertuo-omni-loop', 'bug',    601, 'A red button'),
         ('00000000-0000-4000-8000-00000000f002'::uuid, 'vertuoza', 'vertuoza/vertuo-omni-loop', 'visual', 602, 'A darker sidebar'),
         ('00000000-0000-4000-8000-00000000f003'::uuid, 'acme',     'acme/widgets',              'bug',    3,   'A broken widget')
       ) as d (id, slug, repo, kind, prd, title)
  join public.workspaces w on w.slug = d.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role stores, and refreshes in place ──
set local role service_role;
do $$
declare
  vertuoza uuid := (select id from public.workspaces where slug = 'vertuoza');
  acme     uuid := (select id from public.workspaces where slug = 'acme');
begin
  insert into public.fix_facts (dossier_id, workspace_id, facts) values
    ('00000000-0000-4000-8000-00000000f001', vertuoza, '{"issue":"unread","pull":null,"approvals":[],"release":null}'),
    ('00000000-0000-4000-8000-00000000f002', vertuoza, '{"issue":null,"pull":null,"approvals":[],"release":null}'),
    ('00000000-0000-4000-8000-00000000f003', acme,     '{"issue":null,"pull":null,"approvals":[],"release":null}');

  -- A refresh, as the sync or a fix page writes it: an upsert.
  insert into public.fix_facts (dossier_id, workspace_id, facts, synced_at)
  values ('00000000-0000-4000-8000-00000000f001', vertuoza, '{"issue":null,"pull":"unread","approvals":"unread","release":"unread"}', '2026-09-29T09:00:00Z')
  on conflict (dossier_id)
  do update set facts = excluded.facts, synced_at = excluded.synced_at;
  if (select facts ->> 'pull' from public.fix_facts where dossier_id = '00000000-0000-4000-8000-00000000f001') <> 'unread' then
    raise exception 'FAIL: a refresh did not replace the facts';
  end if;
  if (select count(*) from public.fix_facts) <> 3 then
    raise exception 'FAIL: a refresh added a row';
  end if;

  begin
    insert into public.fix_facts (dossier_id, workspace_id, facts) values ('00000000-0000-4000-8000-00000000f0ff', vertuoza, '{}');
    raise exception 'FAIL: facts were stored for no dossier';
  exception when foreign_key_violation then null; end;
  begin
    update public.fix_facts set facts = '[]' where dossier_id = '00000000-0000-4000-8000-00000000f002';
    raise exception 'FAIL: facts were stored as something else than an object';
  exception when check_violation then null; end;
  begin
    delete from public.fix_facts;
    raise exception 'FAIL: the service role deleted fix facts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.fix_facts limit 1; raise exception 'FAIL: anon read the fix facts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's rows only, and writes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  if (select count(*) from public.fix_facts) <> 2
     or exists (select 1 from public.fix_facts where dossier_id = '00000000-0000-4000-8000-00000000f003') then
    raise exception 'FAIL: a member did not read exactly their workspace''s fix facts';
  end if;
  begin
    insert into public.fix_facts (dossier_id, workspace_id, facts)
    values ('00000000-0000-4000-8000-00000000f003', (select id from public.workspaces where slug = 'vertuoza'), '{}');
    raise exception 'FAIL: a member stored fix facts';
  exception when insufficient_privilege then null; end;
  begin
    update public.fix_facts set facts = '{}';
    raise exception 'FAIL: a member refreshed fix facts';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.fix_facts;
    raise exception 'FAIL: a member deleted fix facts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if (select count(*) from public.fix_facts) <> 1
     or exists (select 1 from public.fix_facts where dossier_id <> '00000000-0000-4000-8000-00000000f003') then
    raise exception 'FAIL: a member of another workspace read Vertuoza''s fix facts';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.fix_facts) then
    raise exception 'FAIL: an account in no workspace read fix facts';
  end if;
end $$;
reset role;

-- ── A row goes with its dossier ──
delete from public.dossiers where id = '00000000-0000-4000-8000-00000000f002';
do $$
begin
  if exists (select 1 from public.fix_facts where dossier_id = '00000000-0000-4000-8000-00000000f002') then
    raise exception 'FAIL: a dossier''s fix facts outlived it';
  end if;
end $$;

-- ── Grants ──
do $$
begin
  if has_table_privilege('authenticated', 'public.fix_facts', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the signed-in may write the fix facts';
  end if;
  if has_table_privilege('anon', 'public.fix_facts', 'select, insert, update, delete') then
    raise exception 'FAIL: anon may touch the fix facts';
  end if;
  if has_table_privilege('service_role', 'public.fix_facts', 'delete, truncate') then
    raise exception 'FAIL: the service role may delete fix facts';
  end if;
end $$;

-- ── The facts read their summary from the rows (PRD 2011 s5) ──
-- A product bug's rows (written here directly, as fix_bug_push() would) give its facts their `rows` part
-- and its `pull`, whatever a write says; a bug with no rows keeps what was written.
do $$
declare
  ws      uuid := (select id from public.workspaces where slug = 'vertuoza');
  product uuid;
  bug     uuid;
  facts   jsonb;
begin
  insert into public.businesses (workspace_id, name)
  select ws, 'Vertuoza' where not exists (select 1 from public.businesses b where b.workspace_id = ws);
  insert into public.products (workspace_id, business_id, name, key)
  values (ws, (select b.id from public.businesses b where b.workspace_id = ws), 'Facts product', 'facts')
  returning id into product;
  insert into public.repositories (workspace_id, full_name) values (ws, 'vertuoza/facts-api');
  insert into public.dossiers (workspace_id, kind, product_id, product_seq, title, numbered_at, birthplace)
  values (ws, 'bug', product, 1, 'A product bug', now(), 'server') returning id into bug;
  insert into public.fix_rows (dossier_id, workspace_id, position, repository, pull, changes, merged_at) values
    (bug, ws, 1, 'vertuoza/facts-api', 3, 'The first fix.', '2026-10-16T09:00:00Z'),
    (bug, ws, 2, 'vertuoza/facts-api', 4, 'The second fix.', null);
  facts := (select f.facts from public.fix_facts f where f.dossier_id = bug);
  if facts is null or facts -> 'rows' ->> 'rows' <> '2' or facts -> 'rows' ->> 'merged' <> '1' or (facts -> 'rows' ->> 'shipped')::boolean
     or facts -> 'pull' ->> 'number' <> '4' or facts -> 'pull' ->> 'state' <> 'open' then
    raise exception 'FAIL: a product bug''s facts do not read its rows: %', facts;
  end if;
  -- The sync writes what GitHub said: the rows' summary stays.
  update public.fix_facts f set facts = '{"issue": "unread", "pull": "unread", "approvals": [], "release": null}' where f.dossier_id = bug;
  facts := (select f.facts from public.fix_facts f where f.dossier_id = bug);
  if facts -> 'rows' ->> 'rows' <> '2' or facts -> 'pull' ->> 'number' <> '4' or facts ->> 'issue' <> 'unread' then
    raise exception 'FAIL: a write over a product bug''s facts dropped what its rows say: %', facts;
  end if;
  update public.fix_rows r set merged_at = '2026-10-16T10:00:00Z' where r.dossier_id = bug and r.position = 2;
  facts := (select f.facts from public.fix_facts f where f.dossier_id = bug);
  if not (facts -> 'rows' ->> 'shipped')::boolean or facts -> 'pull' ->> 'state' <> 'merged' or facts -> 'pull' ->> 'number' <> '4' then
    raise exception 'FAIL: the last merged row did not ship the bug''s facts: %', facts;
  end if;
  -- A bug of a repository, with no rows: its facts as written, with no rows part.
  update public.fix_facts f set facts = '{"issue": null, "pull": "unread", "approvals": [], "release": null}'
   where f.dossier_id = '00000000-0000-4000-8000-00000000f001';
  if (select f.facts from public.fix_facts f where f.dossier_id = '00000000-0000-4000-8000-00000000f001')
     <> '{"issue": null, "pull": "unread", "approvals": [], "release": null}'::jsonb then
    raise exception 'FAIL: a bug with no rows did not keep its facts as written';
  end if;
end $$;

select 'fix facts checks passed' as result;
rollback;
