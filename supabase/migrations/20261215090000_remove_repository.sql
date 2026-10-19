-- Removing a repository from a workspace (PRD 2188, docs:
-- .omni-loop/delivery/inbox/2188-remove-repository/spec.md §1). Removing hides it and keeps its history:
-- deleting the row would cascade to its ideas, pull requests, reviews, product links and knowledge packs.
--
-- - repositories.removed_at: when the owner removed it, null while it is listed.
-- - remove_repository(): owner only (repository_owner_only, 42501), P0002 for a repository the workspace
--   does not list. In one transaction it sets removed_at, switches tracking and the public board off,
--   drops the repository from every link's consumes, deletes its product links and clears every product's
--   plan repository that names it. Removing a repository already removed answers it as it is.
-- - add_repository() lists a removed repository again, tracked. Its ideas, pull requests and knowledge
--   packs are there again; its product links and plan repository are not.
-- - product_repository_link() and product_plan_repository_set() refuse a removed repository with their
--   P0002, as one the workspace does not list.
--
-- Ideas, pull requests, knowledge packs and the collector's columns are left untouched. The collector
-- and the Engineering board read only tracked repositories, and a removed one is untracked.
--
-- Proven by supabase/checks/repositories.sql.
--
-- Rollback: a follow-up migration sets removed_at to null on every row, drops remove_repository() and
-- the column, and restores add_repository() as 20261008090000_repositories.sql defines it,
-- product_repository_link() as 20261129090000_product_repositories.sql does and
-- product_plan_repository_set() as 20261212100000_knowledge_packs.sql does. The links and plan
-- repositories a remove deleted are not restored.

alter table public.repositories add column removed_at timestamptz;

comment on column public.repositories.removed_at is
  'PRD 2188: when the workspace''s owner removed the repository (remove_repository()), or null while it is listed. A removed repository is untracked and keeps its history; add_repository() lists it again.';
comment on table public.repositories is
  'A workspace''s repositories (PRD 612), owner/name in lower case. Its owner adds one, switches its tracking or removes it through add_repository(), set_repository_tracked() and remove_repository(); nothing deletes one. Only a tracked repository is collected and counted on the Engineering board, and only a tracked repository''s PRDs are read by the game (PRD 728); switching tracking off, or removing it (PRD 2188), keeps its rows.';

-- Removes a repository from the workspace: hidden, untracked, its board private, out of every product
-- and no product's plan repository. Its ideas, pull requests and knowledge packs stay. Removing one
-- already removed answers it as it is.
create function public.remove_repository(p_workspace uuid, p_full_name text) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  repo text := lower(btrim(coalesce(p_full_name, '')));
  gone public.repositories;
begin
  perform public.repository_owner_only(p_workspace);
  select * into gone from public.repositories r
   where r.workspace_id = p_workspace and r.full_name = repo
     for update;
  if not found then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  if gone.removed_at is not null then
    return gone;
  end if;

  update public.products p set plan_repository = null
   where p.workspace_id = p_workspace and p.plan_repository = repo;
  update public.product_repositories l set consumes = array_remove(l.consumes, repo)
   where l.workspace_id = p_workspace and repo = any (l.consumes);
  delete from public.product_repositories l
   where l.workspace_id = p_workspace and l.repository = repo;
  update public.repositories r
     set removed_at = now(), tracked = false, public_ideas = false
   where r.workspace_id = p_workspace and r.full_name = repo
  returning * into gone;
  return gone;
end;
$$;

-- As 20261008090000_repositories.sql: adds a repository to the workspace, tracked; adding one already
-- listed answers it as it is. PRD 2188: adding a removed one lists it again, tracked.
create or replace function public.add_repository(p_workspace uuid, p_full_name text) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  made public.repositories;
begin
  perform public.repository_owner_only(p_workspace);
  if name !~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$' then
    raise exception 'Repository: owner/name, as GitHub spells it.' using errcode = '22023', hint = 'full_name';
  end if;
  insert into public.repositories (workspace_id, full_name, added_by)
  values (p_workspace, name, auth.uid())
  on conflict (workspace_id, full_name) do update
    set removed_at = null, tracked = true
    where public.repositories.removed_at is not null
  returning * into made;
  if not found then
    select * into made from public.repositories r where r.workspace_id = p_workspace and r.full_name = name;
  end if;
  return made;
end;
$$;

-- As 20261129090000_product_repositories.sql, refusing a removed repository (PRD 2188) as one the
-- workspace does not list.
create or replace function public.product_repository_link(
  p_product    uuid,
  p_repository text,
  p_role       text default null,
  p_knowledge  text default 'own',
  p_read_at    text default null,
  p_read_only  boolean default false,
  p_consumes   text[] default '{}'
) returns public.product_repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned    public.products;
  repo     text := lower(btrim(coalesce(p_repository, '')));
  v_role   text := nullif(btrim(coalesce(p_role, '')), '');
  v_read   text := nullif(lower(btrim(coalesce(p_read_at, ''))), '');
  v_uses   text[];
  made     public.product_repositories;
begin
  owned := public.product_repository_owned(p_product);
  if not exists (select 1 from public.repositories r
                  where r.workspace_id = owned.workspace_id and r.full_name = repo and r.removed_at is null) then
    raise exception 'Repository: no repository % in this workspace.', p_repository using errcode = 'P0002', hint = 'repository';
  end if;
  if v_role is not null and not (v_role ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and char_length(v_role) <= 40) then
    raise exception 'Role: % is not one kebab-case word.', v_role using errcode = '22023', hint = 'role';
  end if;
  if p_knowledge is null or p_knowledge not in ('own', 'imported', 'none') then
    raise exception 'Knowledge: own, imported or none.' using errcode = '22023', hint = 'knowledge';
  end if;
  if p_knowledge = 'imported' and v_read is null then
    raise exception 'Read at: an imported knowledge base names the commit it was read at.' using errcode = '22023', hint = 'read_at';
  end if;
  if p_knowledge <> 'imported' and v_read is not null then
    raise exception 'Read at: only an imported knowledge base is read at a commit.' using errcode = '22023', hint = 'read_at';
  end if;
  if v_read is not null and v_read !~ '^[0-9a-f]{40}$' then
    raise exception 'Read at: % is not a 40-hex commit.', p_read_at using errcode = '22023', hint = 'read_at';
  end if;
  select coalesce(array_agg(distinct u order by u), '{}') into v_uses
    from (select lower(btrim(c)) u from unnest(coalesce(p_consumes, '{}')) c where nullif(btrim(c), '') is not null) x;
  if repo = any (v_uses) then
    raise exception 'Consumes: % cannot consume itself.', repo using errcode = '22023', hint = 'consumes';
  end if;

  insert into public.product_repositories (product_id, workspace_id, repository, role, knowledge, read_at, read_only, consumes, added_by)
  values (owned.id, owned.workspace_id, repo, v_role, p_knowledge, v_read, coalesce(p_read_only, false), v_uses, 'person')
  on conflict (product_id, repository) do update
    set role = excluded.role, knowledge = excluded.knowledge, read_at = excluded.read_at,
        read_only = excluded.read_only, consumes = excluded.consumes
  returning * into made;
  return made;
end;
$$;

-- As 20261212100000_knowledge_packs.sql, refusing a removed repository (PRD 2188) as one the workspace
-- does not list.
create or replace function public.product_plan_repository_set(p_product uuid, p_repository text) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
  repo  text := nullif(lower(btrim(coalesce(p_repository, ''))), '');
  got   public.products;
begin
  owned := public.product_repository_owned(p_product);
  if repo is not null and not exists (select 1 from public.repositories r
                                       where r.workspace_id = owned.workspace_id and r.full_name = repo and r.removed_at is null) then
    raise exception 'Repository: % is not one of this workspace''s repositories.', repo using errcode = 'P0002', hint = 'plan_repository';
  end if;
  update public.products p set plan_repository = repo where p.id = owned.id returning * into got;
  return got;
end;
$$;

revoke execute on function public.remove_repository(uuid, text) from public, anon;
grant execute on function public.remove_repository(uuid, text) to authenticated;
