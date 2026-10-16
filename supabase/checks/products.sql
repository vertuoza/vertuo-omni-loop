-- A product's plan repository (PRD 2011 s10). The supabase workflow runs it on
-- every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/products.sql
-- A product names no plan repository until an owner sets one, through product_plan_repository_set(), from
-- the repositories its workspace lists. Only an owner of the workspace calls it: a member, an owner of
-- another workspace and anyone signed out are refused, and nothing changes. Nobody signed in
-- writes the columns directly; every member reads them. One transaction, rolled back at the end. Any
-- `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000020111a1', 'olga@plans.test'),
  ('00000000-0000-4000-8000-0000020111b1', 'mia@plans.test'),
  ('00000000-0000-4000-8000-0000020111c1', 'oscar@plans.test');
-- Olga owns Vertuoza and Mia is a member of it; Oscar owns Acme.
insert into public.workspaces (slug, name, github_org) values ('acme-plans', 'Acme', 'acme-plans');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values ('vertuoza', '00000000-0000-4000-8000-0000020111a1'::uuid, 'owner'),
               ('vertuoza', '00000000-0000-4000-8000-0000020111b1'::uuid, 'member'),
               ('acme-plans', '00000000-0000-4000-8000-0000020111c1'::uuid, 'owner')) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
insert into public.businesses (workspace_id, name)
select w.id, w.name from public.workspaces w
 where w.slug in ('vertuoza', 'acme-plans') and not exists (select 1 from public.businesses b where b.workspace_id = w.id);
insert into public.products (workspace_id, business_id, name, key)
select b.workspace_id, b.id, 'Plan Mobile', 'planmobile'
  from public.businesses b join public.workspaces w on w.id = b.workspace_id where w.slug = 'vertuoza';
-- Plan Mobile holds plan-api (step 5) and plan-web (step 3); plan-hub is the plan repository, listed and in
-- no product; acme-plans/hub is Acme's.
insert into public.repositories (workspace_id, full_name)
select w.id, r.name
  from (values ('vertuoza', 'vertuoza/plan-api'), ('vertuoza', 'vertuoza/plan-web'), ('vertuoza', 'vertuoza/plan-hub'),
               ('acme-plans', 'acme-plans/hub')) as r (slug, name)
  join public.workspaces w on w.slug = r.slug;
insert into public.product_repositories (product_id, workspace_id, repository, added_by, ladder_step)
select p.id, p.workspace_id, r.name, 'person', r.step
  from (values ('vertuoza/plan-api', 5), ('vertuoza/plan-web', 3)) as r (name, step)
  join public.products p on p.name = 'Plan Mobile';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.product() returns uuid language sql security definer as $$
  select p.id from public.products p where p.name = 'Plan Mobile';
$$;
create function pg_temp.plan() returns text language sql security definer as $$
  select coalesce(p.plan_repository, '-') from public.products p where p.name = 'Plan Mobile';
$$;

-- Runs a call that must be refused with `code`, its message holding `words` when given.
create function pg_temp.refused(stmt text, code text, why text, words text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if words is not null and position(words in sqlerrm) = 0 then
    raise exception 'FAIL: % said "%", not naming "%"', why, sqlerrm, words;
  end if;
end;
$$;

-- ── What the migration added, and who may write it ──
do $$
begin
  if has_column_privilege('authenticated', 'public.products', 'plan_repository', 'update') then
    raise exception 'FAIL: a product''s plan repository is written other than through its function';
  end if;
  if not has_column_privilege('authenticated', 'public.products', 'plan_repository', 'select') then
    raise exception 'FAIL: a member cannot read a product''s plan repository';
  end if;
  if has_function_privilege('anon', 'public.product_plan_repository_set(uuid, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.product_plan_repository_set(uuid, text)', 'execute') then
    raise exception 'FAIL: the plan repository''s function is not the signed-in''s alone';
  end if;
  if pg_temp.plan() <> '-' then
    raise exception 'FAIL: a product names a plan repository before anyone sets one: %', pg_temp.plan();
  end if;
end $$;

-- ── Signed out, a member, another workspace's owner: refused, nothing changes ──
set local role anon;
select pg_temp.refused(format('select public.product_plan_repository_set(%L, ''vertuoza/plan-hub'')', pg_temp.product()), '42501', 'anon setting a plan repository');
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020111b1');
select pg_temp.refused(format('select public.product_plan_repository_set(%L, ''vertuoza/plan-hub'')', pg_temp.product()), '42501', 'a member setting a plan repository');
select pg_temp.refused($q$update public.products set plan_repository = 'vertuoza/plan-hub'$q$, '42501', 'a member writing the column');
select pg_temp.sign_in('00000000-0000-4000-8000-0000020111c1');
select pg_temp.refused(format('select public.product_plan_repository_set(%L, ''vertuoza/plan-hub'')', pg_temp.product()), '42501', 'another workspace''s owner');
reset role;
do $$ begin
  if pg_temp.plan() <> '-' then raise exception 'FAIL: a refused call changed the plan repository: %', pg_temp.plan(); end if;
end $$;

-- ── Olga, an owner, sets the plan repository ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020111a1');
select pg_temp.refused(format('select public.product_plan_repository_set(%L, ''acme-plans/hub'')', pg_temp.product()), 'P0002', 'another workspace''s repository', 'acme-plans/hub');
select pg_temp.refused(format('select public.product_plan_repository_set(%L, ''vertuoza/nowhere'')', pg_temp.product()), 'P0002', 'a repository nobody listed', 'vertuoza/nowhere');
select pg_temp.refused(format('select public.product_plan_repository_set(%L, ''vertuoza/plan-hub'')', gen_random_uuid()), 'P0002', 'no such product');
do $$
declare
  got public.products := public.product_plan_repository_set(pg_temp.product(), ' Vertuoza/Plan-Hub ');
begin
  if got.plan_repository <> 'vertuoza/plan-hub' then
    raise exception 'FAIL: setting the plan repository answered %', row_to_json(got);
  end if;
end $$;
-- It can be cleared.
do $$
declare
  got public.products := public.product_plan_repository_set(pg_temp.product(), '');
begin
  if got.plan_repository is not null then raise exception 'FAIL: clearing the plan repository answered %', row_to_json(got); end if;
end $$;
-- Mia, a member, reads the columns.
select pg_temp.sign_in('00000000-0000-4000-8000-0000020111b1');
do $$ begin
  if (select count(*) from public.products p where p.name = 'Plan Mobile' and p.plan_repository is null) <> 1 then
    raise exception 'FAIL: a member does not read the product''s plan repository';
  end if;
end $$;
reset role;

-- ── The table refuses a plan repository the workspace does not list ──
select pg_temp.refused(format('update public.products set plan_repository = ''acme-plans/hub'' where id = %L', pg_temp.product()), '23503', 'another workspace''s repository');

rollback;

select 'products checks passed' as result;
