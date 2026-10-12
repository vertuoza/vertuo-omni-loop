-- A PRD's and an idea's product, optional (PRD 1364 s2). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/prd_product.sql
-- dossiers.product_id and ideas.product_id exist, nullable, and go null when their product is deleted.
-- A dossier's first push takes its repository's product when the repository is in one product, none
-- when it is in none, and, in several, the product the push names among them, or none. A later push
-- never changes it. An idea follows the same rule when it is created, never asking: several give none.
-- dossier_set_product() lets any member change a dossier's product, refusing another workspace's
-- product, and refusing with `product is locked: PRD <n> is approved` while an approval is in force; a
-- void lifts the lock. A member changes an idea's product directly, within the workspace. Giving a PRD a
-- product links its home repository and every repository its plan's Repositories table names to that
-- product (added_by = prd), leaving an existing link as is; unlinking a repository leaves the PRD's
-- product, and its next push links it again. One transaction, rolled back at the end. Any `FAIL:` stops
-- the run.

begin;

-- ── The columns ──
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'dossiers' and column_name = 'product_id' and is_nullable = 'YES') then
    raise exception 'FAIL: dossiers.product_id is missing, or required';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'ideas' and column_name = 'product_id' and is_nullable = 'YES') then
    raise exception 'FAIL: ideas.product_id is missing, or required';
  end if;
  if not has_column_privilege('authenticated', 'public.dossiers', 'product_id', 'select') then
    raise exception 'FAIL: a member cannot read a dossier''s product';
  end if;
  if has_column_privilege('authenticated', 'public.dossiers', 'product_id', 'update')
     or has_column_privilege('authenticated', 'public.dossiers', 'product_id', 'insert')
     or has_column_privilege('service_role', 'public.dossiers', 'product_id', 'update') then
    raise exception 'FAIL: a dossier''s product is written other than through dossier_push() and dossier_set_product()';
  end if;
  if not has_column_privilege('authenticated', 'public.ideas', 'product_id', 'update')
     or has_column_privilege('authenticated', 'public.ideas', 'product_id', 'insert')
     or has_column_privilege('anon', 'public.ideas', 'product_id', 'update') then
    raise exception 'FAIL: an idea''s product is not changed by a member alone, or is set at its birth by its writer';
  end if;
end $$;

-- ── The cast ──
-- Olga owns PP, Mo and Irisa are members of it; Carl owns PP Other; Sam belongs to no workspace.
-- PP has Mobile, Estimates and Web. pp-org/solo is in Mobile; pp-org/api in Mobile and Estimates;
-- pp-org/lone, pp-org/web, pp-org/infra and pp-org/bare in none. PP Other has its own product, Other.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000013642a1', 'olga@pp.test'),
  ('00000000-0000-4000-8000-0000013642b1', 'mo@pp.test'),
  ('00000000-0000-4000-8000-0000013642b2', 'irisa@pp.test'),
  ('00000000-0000-4000-8000-0000013642c1', 'carl@pp-other.test'),
  ('00000000-0000-4000-8000-0000013642d1', 'sam@pp.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000001364200', 'pp', 'PP', 'pp-org'),
  ('00000000-0000-4000-8000-000001364201', 'pp-other', 'PP Other', 'pp-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000001364200', '00000000-0000-4000-8000-0000013642a1', 'owner'),
  ('00000000-0000-4000-8000-000001364200', '00000000-0000-4000-8000-0000013642b1', 'member'),
  ('00000000-0000-4000-8000-000001364200', '00000000-0000-4000-8000-0000013642b2', 'member'),
  ('00000000-0000-4000-8000-000001364201', '00000000-0000-4000-8000-0000013642c1', 'owner');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000013642f0', '00000000-0000-4000-8000-000001364200', 'PP'),
  ('00000000-0000-4000-8000-0000013642f1', '00000000-0000-4000-8000-000001364201', 'PP Other');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000013642e1', '00000000-0000-4000-8000-000001364200', '00000000-0000-4000-8000-0000013642f0', 'Mobile'),
  ('00000000-0000-4000-8000-0000013642e2', '00000000-0000-4000-8000-000001364200', '00000000-0000-4000-8000-0000013642f0', 'Estimates'),
  ('00000000-0000-4000-8000-0000013642e3', '00000000-0000-4000-8000-000001364200', '00000000-0000-4000-8000-0000013642f0', 'Web'),
  ('00000000-0000-4000-8000-0000013642e9', '00000000-0000-4000-8000-000001364201', '00000000-0000-4000-8000-0000013642f1', 'Other');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000001364200', 'pp-org/solo'),
  ('00000000-0000-4000-8000-000001364200', 'pp-org/api'),
  ('00000000-0000-4000-8000-000001364200', 'pp-org/lone'),
  ('00000000-0000-4000-8000-000001364200', 'pp-org/web'),
  ('00000000-0000-4000-8000-000001364200', 'pp-org/infra'),
  ('00000000-0000-4000-8000-000001364200', 'pp-org/bare');
insert into public.product_repositories (product_id, workspace_id, repository, role, added_by) values
  ('00000000-0000-4000-8000-0000013642e1', '00000000-0000-4000-8000-000001364200', 'pp-org/solo', 'mobile', 'person'),
  ('00000000-0000-4000-8000-0000013642e1', '00000000-0000-4000-8000-000001364200', 'pp-org/api', 'api', 'person'),
  ('00000000-0000-4000-8000-0000013642e2', '00000000-0000-4000-8000-000001364200', 'pp-org/api', 'api', 'person');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.product(name text) returns uuid language sql as $$
  select p.id from public.products p where p.name = product.name;
$$;
-- A dossier's product, by its repository, kind and number.
create function pg_temp.product_of(repo text, prd integer, kind text default 'prd') returns text language sql as $$
  select coalesce(p.name, 'none')
    from public.dossiers d left join public.products p on p.id = d.product_id
   where d.home_repo = repo and d.prd = product_of.prd and d.kind = product_of.kind;
$$;
create function pg_temp.dossier(repo text, prd integer) returns uuid language sql as $$
  select d.id from public.dossiers d where d.home_repo = repo and d.prd = dossier.prd and d.kind = 'prd';
$$;
-- A push of `kinds`, mapping each kind to its content, naming `product` (or none).
create function pg_temp.push(repo text, prd integer, kinds jsonb, product text default null, kind text default 'prd') returns jsonb language sql as $$
  select public.dossier_push(repo, prd, 'PRD ' || prd, null,
    coalesce((select jsonb_agg(jsonb_build_object('kind', k.key, 'content', k.value #>> '{}')) from jsonb_each(kinds) k), '[]'::jsonb),
    kind, product);
$$;
-- The link of a repository to a product: its added_by, or 'none'.
create function pg_temp.link(product text, repo text) returns text language sql as $$
  select coalesce((select l.added_by from public.product_repositories l
                    where l.product_id = pg_temp.product(link.product) and l.repository = repo), 'none');
$$;
-- Runs a call that must be refused with `code`, its message holding `says` when given.
create function pg_temp.refused(stmt text, code text, why text, says text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if says is not null and sqlerrm <> says then raise exception 'FAIL: % said "%", not "%"', why, sqlerrm, says; end if;
end;
$$;
grant execute on function pg_temp.refused(text, text, text, text) to anon, authenticated;

set local role authenticated;

-- ── Birth: one product taken, none none, several the one named or none ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000013642b1');
do $$
declare
  made jsonb;
begin
  made := pg_temp.push('pp-org/solo', 1, '{"spec": "# One"}');
  if pg_temp.product_of('pp-org/solo', 1) <> 'Mobile' then
    raise exception 'FAIL: a PRD born in a repository of one product did not take it: %', pg_temp.product_of('pp-org/solo', 1);
  end if;
  if made -> 'product' ->> 'name' is distinct from 'Mobile' or (made -> 'product' ->> 'id')::uuid <> pg_temp.product('Mobile') then
    raise exception 'FAIL: the push did not answer the PRD''s product: %', made;
  end if;

  made := pg_temp.push('pp-org/lone', 2, '{"spec": "# None"}');
  if pg_temp.product_of('pp-org/lone', 2) <> 'none' or made -> 'product' <> 'null'::jsonb then
    raise exception 'FAIL: a PRD born in a repository of no product has one: %', made;
  end if;

  made := pg_temp.push('pp-org/api', 3, '{"spec": "# Named"}', ' estimates ');
  if pg_temp.product_of('pp-org/api', 3) <> 'Estimates' then
    raise exception 'FAIL: a PRD born in a repository of several products did not take the one named: %', pg_temp.product_of('pp-org/api', 3);
  end if;

  perform pg_temp.push('pp-org/api', 4, '{"spec": "# Unnamed"}');
  if pg_temp.product_of('pp-org/api', 4) <> 'none' then
    raise exception 'FAIL: a PRD born in a repository of several products, naming none, has one';
  end if;

  perform pg_temp.push('pp-org/api', 5, '{"spec": "# Elsewhere"}', 'Web');
  if pg_temp.product_of('pp-org/api', 5) <> 'none' then
    raise exception 'FAIL: a PRD took a product its repository is not in';
  end if;

  perform pg_temp.push('pp-org/solo', 6, '{"spec": "# Overruled"}', 'Estimates');
  if pg_temp.product_of('pp-org/solo', 6) <> 'Mobile' then
    raise exception 'FAIL: a name overruled the only product of the repository';
  end if;

  perform pg_temp.push('pp-org/solo', 1, '{"bug-record": "# A bug"}', null, 'bug');
  if pg_temp.product_of('pp-org/solo', 1, 'bug') <> 'Mobile' then
    raise exception 'FAIL: a bug fix born in a repository of one product did not take it';
  end if;

  -- A later push never changes the product, whatever it names.
  perform pg_temp.push('pp-org/api', 4, '{"spec": "# Unnamed, again"}', 'Mobile');
  if pg_temp.product_of('pp-org/api', 4) <> 'none' then
    raise exception 'FAIL: a later push named a product';
  end if;
end $$;

-- A draft numbered by its first push is born then.
do $$
declare
  draft uuid := public.dossier_open('Drafted', 'pp-org/solo');
begin
  perform public.dossier_push('pp-org/solo', 8, 'Drafted', draft,
    '[{"kind": "spec", "content": "# Drafted"}]'::jsonb);
  if pg_temp.product_of('pp-org/solo', 8) <> 'Mobile' then
    raise exception 'FAIL: a draft numbered in a repository of one product did not take it';
  end if;
end $$;

-- ── The PRD's repositories join its product ──
do $$
begin
  if pg_temp.link('Estimates', 'pp-org/api') <> 'person' then
    raise exception 'FAIL: a PRD rewrote an existing link';
  end if;
  perform pg_temp.push('pp-org/solo', 1, jsonb_build_object('plan', E'# Plan\n\n## Repositories\n\n| repo | role | read at | knowledge |\n| --- | --- | --- | --- |\n| `web` | web | — | own |\n| pp-org/infra | infra | — | none |\n| ghost | ghost | — | none |\n| solo | plan | — | own |\n\n## Slices\n\n| id | repo | slice |\n| --- | --- | --- |\n| s1 | api | A |\n'));
  if pg_temp.link('Mobile', 'pp-org/web') <> 'prd' or pg_temp.link('Mobile', 'pp-org/infra') <> 'prd' then
    raise exception 'FAIL: the repositories a PRD''s plan names did not join its product: web %, infra %',
      pg_temp.link('Mobile', 'pp-org/web'), pg_temp.link('Mobile', 'pp-org/infra');
  end if;
  if pg_temp.link('Mobile', 'pp-org/solo') <> 'person' then
    raise exception 'FAIL: the home repository''s link was rewritten';
  end if;
  if exists (select 1 from public.product_repositories l where l.repository like '%ghost%') then
    raise exception 'FAIL: a repository the workspace does not list was linked';
  end if;
  if pg_temp.link('Mobile', 'pp-org/api') <> 'person' then
    raise exception 'FAIL: a repository named outside the Repositories table was linked';
  end if;
end $$;

-- ── A member moves a PRD's product before approval ──
do $$
declare
  moved jsonb;
begin
  moved := public.dossier_set_product(pg_temp.dossier('pp-org/lone', 2), pg_temp.product('Estimates'));
  if pg_temp.product_of('pp-org/lone', 2) <> 'Estimates' or moved -> 'product' ->> 'name' is distinct from 'Estimates' then
    raise exception 'FAIL: a member did not move a PRD into a product: %', moved;
  end if;
  if pg_temp.link('Estimates', 'pp-org/lone') <> 'prd' then
    raise exception 'FAIL: moving a PRD into a product did not link its repository';
  end if;
  moved := public.dossier_set_product(pg_temp.dossier('pp-org/lone', 2), null);
  if pg_temp.product_of('pp-org/lone', 2) <> 'none' or moved -> 'product' <> 'null'::jsonb then
    raise exception 'FAIL: a member did not take a PRD out of its product: %', moved;
  end if;
  if pg_temp.link('Estimates', 'pp-org/lone') <> 'prd' then
    raise exception 'FAIL: taking a PRD out of a product unlinked its repository';
  end if;
  perform pg_temp.refused(format('select public.dossier_set_product(%L, %L)', pg_temp.dossier('pp-org/lone', 2), '00000000-0000-4000-8000-0000013642e9'::uuid),
    'P0002', 'another workspace''s product');
  perform pg_temp.refused(format('select public.dossier_set_product(%L, %L)', gen_random_uuid(), pg_temp.product('Mobile')),
    'P0002', 'no such dossier');
  perform pg_temp.refused(format('update public.dossiers set product_id = %L where id = %L', pg_temp.product('Web'), pg_temp.dossier('pp-org/lone', 2)),
    '42501', 'a member, directly');
end $$;

-- Another workspace's owner finds no such dossier; signed out, nothing runs.
select pg_temp.sign_in('00000000-0000-4000-8000-0000013642c1');
do $$
begin
  perform pg_temp.refused(format('select public.dossier_set_product(%L, null)', pg_temp.dossier('pp-org/solo', 1)), 'P0002', 'another workspace''s owner');
end $$;
reset role;
create temporary table ids (name text primary key, id uuid);
insert into ids values ('solo-1', pg_temp.dossier('pp-org/solo', 1));
grant select on ids to anon, authenticated;
set local role anon;
do $$
begin
  perform pg_temp.refused(format('select public.dossier_set_product(%L, null)', (select id from ids where name = 'solo-1')), '42501', 'anon');
end $$;
reset role;
set local role authenticated;

-- ── The lock: while an approval is in force, and lifted by a void ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000013642b1');
do $$
begin
  perform pg_temp.push('pp-org/solo', 7, jsonb_build_object(
    'spec', E'---\nprd: 7\nphase0: server\n---\n\n# Locked\n', 'plan', 'plan 1', 'before-after', '<p>before</p>'));
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000013642b2');
do $$
begin
  perform public.dossier_approve(pg_temp.dossier('pp-org/solo', 7));
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000013642b1');
do $$
begin
  perform pg_temp.refused(format('select public.dossier_set_product(%L, %L)', pg_temp.dossier('pp-org/solo', 7), pg_temp.product('Estimates')),
    '55000', 'a member, while an approval is in force', 'product is locked: PRD 7 is approved');
  perform pg_temp.refused(format('select public.dossier_set_product(%L, null)', pg_temp.dossier('pp-org/solo', 7)),
    '55000', 'a member taking it out, while an approval is in force', 'product is locked: PRD 7 is approved');
  if pg_temp.product_of('pp-org/solo', 7) <> 'Mobile' then
    raise exception 'FAIL: a locked PRD''s product changed';
  end if;
  -- Its own product again is no change, and needs no unlock.
  perform public.dossier_set_product(pg_temp.dossier('pp-org/solo', 7), pg_temp.product('Mobile'));

  perform pg_temp.push('pp-org/solo', 7, jsonb_build_object('plan', 'plan 2'));
  perform public.dossier_set_product(pg_temp.dossier('pp-org/solo', 7), pg_temp.product('Estimates'));
  if pg_temp.product_of('pp-org/solo', 7) <> 'Estimates' then
    raise exception 'FAIL: a void did not unlock the PRD''s product';
  end if;
  if pg_temp.link('Estimates', 'pp-org/solo') <> 'prd' then
    raise exception 'FAIL: moving a PRD did not link its home repository';
  end if;
end $$;

-- ── Unlinking a repository leaves the PRD its product; its next push links it again ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000013642a1');
do $$
begin
  perform public.product_repository_unlink(pg_temp.product('Estimates'), 'pp-org/solo');
  if pg_temp.product_of('pp-org/solo', 7) <> 'Estimates' then
    raise exception 'FAIL: unlinking a repository took the PRD out of its product';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000013642b1');
do $$
begin
  perform pg_temp.push('pp-org/solo', 7, jsonb_build_object('spec', E'---\nprd: 7\nphase0: server\n---\n\n# Locked, again\n'));
  if pg_temp.link('Estimates', 'pp-org/solo') <> 'prd' then
    raise exception 'FAIL: the PRD''s next push did not link its repository again';
  end if;
end $$;

-- ── An idea: the same rule at birth, never asking; a member changes it ──
do $$
declare
  in_one  uuid;
  in_two  uuid;
  in_none uuid;
begin
  insert into public.ideas (workspace_id, repo, title, pitch) values ('00000000-0000-4000-8000-000001364200', 'pp-org/web', 'Web', 'In Mobile alone, by a PRD.') returning id into in_one;
  insert into public.ideas (workspace_id, repo, title, pitch) values ('00000000-0000-4000-8000-000001364200', 'pp-org/solo', 'Solo', 'Mobile, and Estimates by a PRD.') returning id into in_two;
  insert into public.ideas (workspace_id, repo, title, pitch) values ('00000000-0000-4000-8000-000001364200', 'pp-org/bare', 'Bare', 'No product.') returning id into in_none;
  if (select product_id from public.ideas where id = in_one) is distinct from pg_temp.product('Mobile') then
    raise exception 'FAIL: an idea of a repository in one product did not take it';
  end if;
  if (select product_id from public.ideas where id = in_two) is not null or (select product_id from public.ideas where id = in_none) is not null then
    raise exception 'FAIL: an idea of a repository in several products, or none, has a product';
  end if;
  update public.ideas set product_id = pg_temp.product('Estimates') where id = in_two;
  if (select product_id from public.ideas where id = in_two) is distinct from pg_temp.product('Estimates') then
    raise exception 'FAIL: a member did not change an idea''s product';
  end if;
  perform pg_temp.refused(format('update public.ideas set product_id = %L where id = %L', '00000000-0000-4000-8000-0000013642e9'::uuid, in_two),
    '23503', 'an idea moved into another workspace''s product');
  update public.ideas set product_id = null where id = in_one;
  if (select product_id from public.ideas where id = in_one) is not null then
    raise exception 'FAIL: a member did not take an idea out of its product';
  end if;
end $$;
reset role;

-- ── A deleted product leaves its PRDs and ideas with none ──
do $$
begin
  delete from public.products where id = pg_temp.product('Estimates');
  if pg_temp.product_of('pp-org/api', 3) <> 'none' then
    raise exception 'FAIL: a PRD kept a deleted product';
  end if;
  if exists (select 1 from public.ideas i where i.workspace_id = '00000000-0000-4000-8000-000001364200' and i.product_id is not null) then
    raise exception 'FAIL: an idea kept a deleted product';
  end if;
end $$;

select 'prd_product: every check passed';

rollback;
