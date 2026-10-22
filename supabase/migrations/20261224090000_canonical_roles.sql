-- Canonical roles on the Omni page (PRD 2346). A repository's role in a product is one of nine words
-- the kit ships (kit/lib/layers/layers.ts, docs/guide/knowledge-map.md): api, web, mobile, ui, library,
-- infra, plan, doc, monorepo.
--
-- - The roles in use before them are mapped once: back-end and backend read api, front-end and frontend
--   read web, docs reads doc. A role the table cannot map stays as it is: the Repositories tab and
--   `omni targets` flag it until an owner picks one. No other row or column changes.
-- - product_repository_link() refuses a new role outside the nine (22023, hint `role`). null is still
--   accepted, and so is a row's own unchanged old role, so saving the other fields of a flagged link
--   works. Everything else is as 20261215090000_remove_repository.sql.
--
-- Rolled back by reverting this file's function to that migration's; the mapping needs no undo (the
-- canonical word is the same role).

update public.product_repositories
   set role = case role
                when 'back-end' then 'api'
                when 'backend' then 'api'
                when 'front-end' then 'web'
                when 'frontend' then 'web'
                when 'docs' then 'doc'
              end
 where role in ('back-end', 'backend', 'front-end', 'frontend', 'docs');

comment on column public.product_repositories.role is 'One of api, web, mobile, ui, library, infra, plan, doc, monorepo, or null until someone sets it. A row saved before PRD 2346 may hold another word until an owner changes it.';

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
  if v_role is not null
     and v_role not in ('api', 'web', 'mobile', 'ui', 'library', 'infra', 'plan', 'doc', 'monorepo')
     and not exists (select 1 from public.product_repositories l
                      where l.product_id = owned.id and l.repository = repo and l.role = v_role) then
    raise exception 'Role: % is not a role: api, web, mobile, ui, library, infra, plan, doc or monorepo.', v_role
      using errcode = '22023', hint = 'role';
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
