-- Who may read and write the contributions (PRD 328). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/contributions.sql
-- Accounts each with its own JWT. A contribution belongs to a workspace: every member of it reads the
-- workspace's rows, and nothing of another; signed out, or in no workspace, nothing. Nobody signed in
-- inserts, updates or deletes a row, and no policy lets them. Only the service role writes, as
-- `pnpm game:contributions` does: an upsert on (workspace_id, kind, repo, number), which a second run
-- leaves at one row per item. `kind` is `pr-merged`, `prd-opened`, `prd-started` or `prd-shipped`
-- (PRD 572), and a workspace's rows go with it.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- A second workspace, Acme. Ada belongs to Vertuoza, Carl to Acme, Fay to both, Eve to none.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000f1', 'fay@example.com'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid),
         ('vertuoza', '00000000-0000-4000-8000-0000000000f1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000f1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── Only the service role writes, and the table's own rules hold ──
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.contributions'::regclass) then
    raise exception 'FAIL: public.contributions does not enforce row-level security';
  end if;
  -- Column grants count too: one insertable column is a way to plant a merge.
  if has_any_column_privilege('anon', 'public.contributions', 'select, insert, update, references')
     or has_table_privilege('anon', 'public.contributions', 'select, insert, update, delete, truncate, references, trigger') then
    raise exception 'FAIL: anon holds a grant on public.contributions';
  end if;
  if has_any_column_privilege('authenticated', 'public.contributions', 'insert, update')
     or has_table_privilege('authenticated', 'public.contributions', 'insert, update, delete, truncate') then
    raise exception 'FAIL: a signed-in user may write public.contributions';
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'contributions'
                and (cmd <> 'SELECT' or roles <> array['authenticated']::name[])) then
    raise exception 'FAIL: a policy on public.contributions does more than let a signed-in member read';
  end if;
  if not has_table_privilege('service_role', 'public.contributions', 'select')
     or not has_table_privilege('service_role', 'public.contributions', 'insert')
     or not has_table_privilege('service_role', 'public.contributions', 'update') then
    raise exception 'FAIL: the game workflow cannot read and upsert public.contributions';
  end if;
end $$;

-- The service role writes as game:contributions does, through PostgREST's upsert: every column it
-- sends is set again on a conflict. Twice, as two polls on the same answers.
set local role service_role;
do $$
declare
  v constant uuid := (select id from public.workspaces where slug = 'vertuoza');
  acme constant uuid := (select id from public.workspaces where slug = 'acme');
  run int;
begin
  for run in 1..2 loop
    begin
      insert into public.contributions as c (workspace_id, kind, repo, number, login, at) values
        (v,    'pr-merged',  'vertuo-core',      41,  'ada-gh',  '2026-09-27 22:30:00+00'),
        (v,    'prd-opened', 'vertuo-omni-loop', 328, 'ada-gh',  '2026-09-28 07:00:00+00'),
        (v,    'prd-opened', 'vertuo-core',      41,  'fay-gh',  '2026-09-20 09:00:00+00'),  -- the kind is in the key
        (v,    'prd-started', 'vertuo-omni-loop', 328, 'ada-gh', '2026-09-28 12:00:00+00'),  -- a PRD's phase-0 merged
        (v,    'prd-shipped', 'vertuo-omni-loop', 328, 'ada-gh', '2026-09-29 16:00:00+00'),  -- its feature PR merged
        (acme, 'pr-merged',  'acme-api',         7,   'carl-gh', '2026-09-20 10:00:00+00')
      on conflict (workspace_id, kind, repo, number) do update
        set workspace_id = excluded.workspace_id, kind = excluded.kind, repo = excluded.repo,
            number = excluded.number, login = excluded.login, at = excluded.at;
    exception when insufficient_privilege then
      raise exception 'FAIL: the service role cannot upsert public.contributions (%)', sqlerrm;
    end;
  end loop;
  if (select count(*) from public.contributions where workspace_id in (v, acme)) <> 6 then
    raise exception 'FAIL: two runs on the same answers did not leave one row per item';
  end if;
  if (select seen_at from public.contributions where workspace_id = v and kind = 'pr-merged' and number = 41) is null then
    raise exception 'FAIL: a row was written with no seen_at';
  end if;

  begin
    insert into public.contributions (workspace_id, kind, repo, number, login, at) values (v, 'pr-opened', 'vertuo-core', 42, 'ada-gh', now());
    raise exception 'FAIL: public.contributions stored a kind other than pr-merged, prd-opened, prd-started or prd-shipped';
  exception when check_violation then null; end;
  begin
    insert into public.contributions (workspace_id, kind, repo, number, login, at) values (v, 'pr-merged', 'vertuo-core', 41, 'mallory', now());
    raise exception 'FAIL: public.contributions stored a second row for one pull request';
  exception when unique_violation then null; end;
  begin
    insert into public.contributions (workspace_id, kind, repo, number, login, at) values ('00000000-0000-4000-8000-00000000ffff', 'pr-merged', 'vertuo-core', 1, 'ada-gh', now());
    raise exception 'FAIL: public.contributions stored a row of no workspace';
  exception when foreign_key_violation then null; end;
end $$;
reset role;

-- What each workspace holds, for the readers below to compare with.
create temporary table held as
select workspace_id, count(*)::int as n from public.contributions group by workspace_id;
grant select on held to authenticated;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin
    perform 1 from public.contributions limit 1;
    raise exception 'FAIL: anon read public.contributions';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.contributions (workspace_id, kind, repo, number, login, at)
    values ('00000000-0000-4000-8000-00000000ffff', 'pr-merged', 'vertuo-core', 99, 'anon', now());
    raise exception 'FAIL: anon wrote public.contributions';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Signed in: a member reads their workspace's rows, and nobody writes one ──
set local role authenticated;
do $$
declare
  me record;
  n int;
begin
  for me in select * from (values
      ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com', array['vertuoza']),
      ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test',   array['acme']),
      ('00000000-0000-4000-8000-0000000000f1', 'fay@example.com',  array['vertuoza', 'acme']),
      ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com',  array[]::text[])
    ) as m (uid, email, slugs) loop
    perform pg_temp.sign_in(me.uid, me.email);
    -- Every row of each workspace they belong to, and none of another.
    select count(*) into n from public.contributions c
     where c.workspace_id in (select id from public.workspaces where slug = any (me.slugs));
    if n <> (select coalesce(sum(h.n), 0) from held h
              where h.workspace_id in (select id from public.workspaces where slug = any (me.slugs))) then
      raise exception 'FAIL: % read % of their workspaces'' contributions, not all of them', me.email, n;
    end if;
    select count(*) into n from public.contributions c
     where c.workspace_id not in (select id from public.workspaces where slug = any (me.slugs));
    if n <> 0 then raise exception 'FAIL: % read % contributions of a workspace they are not in', me.email, n; end if;
    if cardinality(me.slugs) > 0 and not exists (select 1 from public.contributions) then
      raise exception 'FAIL: % (a member) read no contribution', me.email;
    end if;

    begin
      insert into public.contributions (workspace_id, kind, repo, number, login, at)
      select id, 'pr-merged', 'vertuo-core', 99, 'planted', now() from public.workspaces where slug = 'vertuoza';
      raise exception 'FAIL: % inserted a contribution', me.email;
    exception when insufficient_privilege then null; end;
    begin
      update public.contributions set login = 'someone-else' where kind = 'pr-merged';
      raise exception 'FAIL: % rewrote a contribution', me.email;
    exception when insufficient_privilege then null; end;
    begin
      delete from public.contributions where kind = 'prd-opened';
      raise exception 'FAIL: % deleted a contribution', me.email;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;

-- ── A workspace's rows go with it ──
delete from public.workspaces where slug = 'acme';
do $$
begin
  if exists (select 1 from public.contributions c where not exists (select 1 from public.workspaces w where w.id = c.workspace_id)) then
    raise exception 'FAIL: a deleted workspace left its contributions behind';
  end if;
end $$;

rollback;
