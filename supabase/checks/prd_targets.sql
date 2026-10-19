-- Each PRD's plan targets, stored once (PRD 2174 s1). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/prd_targets.sql
-- prd_targets holds one row per PRD dossier and repository its latest plan's `## Repositories` table
-- names, resolved to owner/name as dossier_link_repositories() resolves them, for a dossier with or
-- without a product. A plan naming two repositories writes those two and not the home repository; the
-- home repository is a target only when the plan names it. A newer plan replaces them, and a push of
-- another kind leaves them. A name the workspace does not list writes nothing. The product linking is
-- unchanged. The migration's backfill, prd_targets_backfill(), writes the rows of a dossier whose plan
-- was pushed before the table existed. A member reads their workspace's rows, a member of another
-- workspace reads none, anyone signed out reads nothing, and no client writes a row or runs the
-- writers. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The table ──
do $$
begin
  if (select array_agg(a.attname::text order by a.attnum)
        from pg_attribute a
       where a.attrelid = 'public.prd_targets'::regclass and a.attnum > 0 and not a.attisdropped)
     is distinct from array['dossier_id', 'workspace_id', 'repository'] then
    raise exception 'FAIL: prd_targets is not (dossier_id, workspace_id, repository)';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public.prd_targets'::regclass and c.contype = 'p')
     is distinct from 'PRIMARY KEY (dossier_id, repository)' then
    raise exception 'FAIL: prd_targets is not keyed by (dossier_id, repository)';
  end if;
  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and tablename = 'prd_targets'
                    and indexdef like '%(workspace_id, repository)%') then
    raise exception 'FAIL: prd_targets has no index on (workspace_id, repository)';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.prd_targets'::regclass) then
    raise exception 'FAIL: prd_targets has no row-level security';
  end if;
  if not has_table_privilege('authenticated', 'public.prd_targets', 'select') then
    raise exception 'FAIL: a member cannot read prd_targets';
  end if;
  if has_table_privilege('anon', 'public.prd_targets', 'select')
     or has_table_privilege('authenticated', 'public.prd_targets', 'insert')
     or has_table_privilege('authenticated', 'public.prd_targets', 'update')
     or has_table_privilege('authenticated', 'public.prd_targets', 'delete')
     or has_table_privilege('service_role', 'public.prd_targets', 'insert')
     or has_table_privilege('service_role', 'public.prd_targets', 'update')
     or has_table_privilege('service_role', 'public.prd_targets', 'delete') then
    raise exception 'FAIL: prd_targets is written, or read signed out, other than through the plan push';
  end if;
  if has_function_privilege('authenticated', 'public.dossier_write_targets(uuid)', 'execute')
     or has_function_privilege('anon', 'public.dossier_write_targets(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.prd_targets_backfill()', 'execute')
     or has_function_privilege('anon', 'public.prd_targets_backfill()', 'execute') then
    raise exception 'FAIL: a client may run the targets'' writers';
  end if;
end $$;

-- ── The cast ──
-- Tess owns TT, Ugo is a member of it; Vic owns TT Other; nobody else. TT lists tt-org/plan (the plan
-- repository, in no product), tt-org/api and tt-org/web (both in Shop), tt-org/infra and tt-org/docs (in
-- none). TT Other lists its own copy of tt-org/web.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000021741a1', 'tess@tt.test'),
  ('00000000-0000-4000-8000-0000021741b1', 'ugo@tt.test'),
  ('00000000-0000-4000-8000-0000021741c1', 'vic@tt-other.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002174100', 'tt', 'TT', 'tt-org'),
  ('00000000-0000-4000-8000-000002174101', 'tt-other', 'TT Other', 'tt-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002174100', '00000000-0000-4000-8000-0000021741a1', 'owner'),
  ('00000000-0000-4000-8000-000002174100', '00000000-0000-4000-8000-0000021741b1', 'member'),
  ('00000000-0000-4000-8000-000002174101', '00000000-0000-4000-8000-0000021741c1', 'owner');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000021741f0', '00000000-0000-4000-8000-000002174100', 'TT');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000021741e1', '00000000-0000-4000-8000-000002174100', '00000000-0000-4000-8000-0000021741f0', 'Shop');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000002174100', 'tt-org/plan'),
  ('00000000-0000-4000-8000-000002174100', 'tt-org/api'),
  ('00000000-0000-4000-8000-000002174100', 'tt-org/web'),
  ('00000000-0000-4000-8000-000002174100', 'tt-org/infra'),
  ('00000000-0000-4000-8000-000002174100', 'tt-org/docs'),
  ('00000000-0000-4000-8000-000002174101', 'tt-org/web');
insert into public.product_repositories (product_id, workspace_id, repository, role, added_by) values
  ('00000000-0000-4000-8000-0000021741e1', '00000000-0000-4000-8000-000002174100', 'tt-org/api', 'api', 'person'),
  ('00000000-0000-4000-8000-0000021741e1', '00000000-0000-4000-8000-000002174100', 'tt-org/web', 'web', 'person');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.dossier(repo text, prd integer) returns uuid language sql as $$
  select d.id from public.dossiers d where d.home_repo = repo and d.prd = dossier.prd and d.kind = 'prd';
$$;
-- A push of `kinds`, mapping each kind to its content.
create function pg_temp.push(repo text, prd integer, kinds jsonb) returns jsonb language sql as $$
  select public.dossier_push(repo, prd, 'PRD ' || prd, null,
    (select jsonb_agg(jsonb_build_object('kind', k.key, 'content', k.value #>> '{}')) from jsonb_each(kinds) k));
$$;
-- A plan whose Repositories table names `names`, then a Slices table naming another repository, which
-- is no target.
create function pg_temp.plan(variadic names text[]) returns text language sql as $$
  select E'# Plan\n\n## Repositories\n\n| repo | role | read at | knowledge |\n| --- | --- | --- | --- |\n'
      || coalesce((select string_agg(format(E'| %s | x | — | own |\n', n), '' order by o) from unnest(names) with ordinality u (n, o)), '')
      || E'\n## Slices\n\n| id | repo | slice |\n| --- | --- | --- |\n| s1 | docs | A |\n';
$$;
-- The dossier's targets, as the caller reads them, sorted and joined: '' for none.
create function pg_temp.targets(repo text, prd integer) returns text language sql as $$
  select coalesce(string_agg(t.repository, ',' order by t.repository), '')
    from public.prd_targets t where t.dossier_id = pg_temp.dossier(repo, prd);
$$;
-- Runs a statement that must be refused with `code`.
create function pg_temp.refused(stmt text, code text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
end;
$$;
grant execute on function pg_temp.refused(text, text, text) to anon, authenticated;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000021741b1');

-- ── A plan push writes its targets, never the home repository on its own account ──
do $$
begin
  -- A plan repository's PRD, in no product: its two targets, by name alone and as owner/name.
  perform pg_temp.push('tt-org/plan', 1, jsonb_build_object('spec', '# One', 'plan', pg_temp.plan('`api`', 'tt-org/web')));
  if (select d.product_id from public.dossiers d where d.id = pg_temp.dossier('tt-org/plan', 1)) is not null then
    raise exception 'FAIL: the cast is wrong: PRD 1 has a product';
  end if;
  if pg_temp.targets('tt-org/plan', 1) <> 'tt-org/api,tt-org/web' then
    raise exception 'FAIL: a plan naming api and web wrote %, not those two alone', pg_temp.targets('tt-org/plan', 1);
  end if;

  -- A PRD of Shop: its targets, and its repositories still join the product as before.
  perform pg_temp.push('tt-org/api', 2, jsonb_build_object('plan', pg_temp.plan('web', 'infra')));
  if pg_temp.targets('tt-org/api', 2) <> 'tt-org/infra,tt-org/web' then
    raise exception 'FAIL: a product''s PRD naming web and infra wrote %', pg_temp.targets('tt-org/api', 2);
  end if;
  if (select l.added_by from public.product_repositories l
       where l.product_id = '00000000-0000-4000-8000-0000021741e1' and l.repository = 'tt-org/infra') is distinct from 'prd'
     or (select l.added_by from public.product_repositories l
          where l.product_id = '00000000-0000-4000-8000-0000021741e1' and l.repository = 'tt-org/api') is distinct from 'person' then
    raise exception 'FAIL: the product linking changed';
  end if;

  -- A name the workspace does not list writes nothing; the rest of the table still counts.
  perform pg_temp.push('tt-org/plan', 3, jsonb_build_object('plan', pg_temp.plan('ghost', 'tt-other/web', 'docs')));
  if pg_temp.targets('tt-org/plan', 3) <> 'tt-org/docs' then
    raise exception 'FAIL: names the workspace does not list wrote %', pg_temp.targets('tt-org/plan', 3);
  end if;

  -- A plan with no Repositories table, and a PRD with no plan, write nothing.
  perform pg_temp.push('tt-org/plan', 4, jsonb_build_object('plan', E'# Plan\n\n## Slices\n\n| id | repo | slice |\n| --- | --- | --- |\n| s1 | api | A |\n'));
  perform pg_temp.push('tt-org/plan', 5, jsonb_build_object('spec', '# Five'));
  if pg_temp.targets('tt-org/plan', 4) <> '' or pg_temp.targets('tt-org/plan', 5) <> '' then
    raise exception 'FAIL: a PRD with no Repositories table, or no plan, has targets: %, %',
      pg_temp.targets('tt-org/plan', 4), pg_temp.targets('tt-org/plan', 5);
  end if;
end $$;

-- ── A newer plan replaces them; a push of another kind leaves them ──
do $$
begin
  perform pg_temp.push('tt-org/plan', 1, jsonb_build_object('plan', pg_temp.plan('infra', 'plan', 'infra')));
  if pg_temp.targets('tt-org/plan', 1) <> 'tt-org/infra,tt-org/plan' then
    raise exception 'FAIL: a newer plan naming infra and the home repository left %', pg_temp.targets('tt-org/plan', 1);
  end if;
  perform pg_temp.push('tt-org/plan', 1, jsonb_build_object('spec', '# One, again'));
  if pg_temp.targets('tt-org/plan', 1) <> 'tt-org/infra,tt-org/plan' then
    raise exception 'FAIL: a spec push changed the targets to %', pg_temp.targets('tt-org/plan', 1);
  end if;
  perform pg_temp.push('tt-org/plan', 1, jsonb_build_object('plan', pg_temp.plan(variadic '{}'::text[])));
  if pg_temp.targets('tt-org/plan', 1) <> '' then
    raise exception 'FAIL: a plan naming no repository left %', pg_temp.targets('tt-org/plan', 1);
  end if;
end $$;

-- ── Who reads them ──
-- Another workspace's owner reads no row; anyone signed out reads nothing.
select pg_temp.sign_in('00000000-0000-4000-8000-0000021741c1');
do $$
begin
  if exists (select 1 from public.prd_targets) then
    raise exception 'FAIL: a member of another workspace reads TT''s targets';
  end if;
end $$;
reset role;
set local role anon;
do $$
begin
  perform pg_temp.refused('select count(*) from public.prd_targets', '42501', 'anon reading the targets');
end $$;
reset role;

-- ── No client writes one ──
create temporary table ids (name text primary key, id uuid);
insert into ids values ('api-2', pg_temp.dossier('tt-org/api', 2));
grant select on ids to anon, authenticated;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000021741a1');
do $$
declare
  api_2 uuid := (select id from ids where name = 'api-2');
begin
  if pg_temp.targets('tt-org/api', 2) <> 'tt-org/infra,tt-org/web' then
    raise exception 'FAIL: the workspace''s owner does not read its targets: %', pg_temp.targets('tt-org/api', 2);
  end if;
  perform pg_temp.refused(format(
    'insert into public.prd_targets (dossier_id, workspace_id, repository) values (%L, %L, %L)',
    api_2, '00000000-0000-4000-8000-000002174100', 'tt-org/docs'), '42501', 'an owner inserting a target');
  perform pg_temp.refused(format('update public.prd_targets set repository = %L where dossier_id = %L', 'tt-org/docs', api_2),
    '42501', 'an owner updating a target');
  perform pg_temp.refused(format('delete from public.prd_targets where dossier_id = %L', api_2),
    '42501', 'an owner deleting a target');
  perform pg_temp.refused(format('select public.dossier_write_targets(%L)', api_2), '42501', 'an owner running the writer');
  perform pg_temp.refused('select public.prd_targets_backfill()', '42501', 'an owner running the backfill');
end $$;
reset role;

-- ── The backfill: a dossier whose plan was pushed before the table existed ──
-- Its version is written with the triggers off, as the rows before the migration were.
do $$
declare
  early uuid;
  wrote integer;
begin
  set local session_replication_role = replica;
  insert into public.dossiers (workspace_id, home_repo, kind, prd, title, numbered_at)
  values ('00000000-0000-4000-8000-000002174100', 'tt-org/plan', 'prd', 9, 'Early', now())
  returning id into early;
  insert into public.dossier_versions (dossier_id, kind, content, sha256, bytes, source, created_at)
  select early, 'plan', p.content, encode(sha256(convert_to(p.content, 'UTF8')), 'hex'), octet_length(p.content), 'kit', p.at
    from (values (pg_temp.plan('docs'), now() - interval '1 day'),
                 (pg_temp.plan('api', 'web'), now())) p (content, at);
  set local session_replication_role = origin;
  if pg_temp.targets('tt-org/plan', 9) <> '' then
    raise exception 'FAIL: the cast is wrong: the early dossier has targets before the backfill';
  end if;

  wrote := public.prd_targets_backfill();
  if pg_temp.targets('tt-org/plan', 9) <> 'tt-org/api,tt-org/web' then
    raise exception 'FAIL: the backfill wrote %, not the latest plan''s api and web', pg_temp.targets('tt-org/plan', 9);
  end if;
  if pg_temp.targets('tt-org/api', 2) <> 'tt-org/infra,tt-org/web' or pg_temp.targets('tt-org/plan', 5) <> '' then
    raise exception 'FAIL: the backfill changed another dossier''s targets';
  end if;
  if wrote < 1 then
    raise exception 'FAIL: the backfill counted % dossiers', wrote;
  end if;
end $$;

-- ── A deleted dossier or repository takes its rows with it ──
do $$
begin
  delete from public.repositories r where r.workspace_id = '00000000-0000-4000-8000-000002174100' and r.full_name = 'tt-org/infra';
  if pg_temp.targets('tt-org/api', 2) <> 'tt-org/web' then
    raise exception 'FAIL: a removed repository stayed a target: %', pg_temp.targets('tt-org/api', 2);
  end if;
  delete from public.dossiers d where d.home_repo = 'tt-org/plan' and d.prd = 9;
  if exists (select 1 from public.prd_targets t
              where t.workspace_id = '00000000-0000-4000-8000-000002174100'
                and not exists (select 1 from public.dossiers d where d.id = t.dossier_id)) then
    raise exception 'FAIL: a deleted dossier left its targets';
  end if;
end $$;

select 'prd_targets: every check passed';

rollback;
