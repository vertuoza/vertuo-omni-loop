-- A repository's products are its links alone (PRD 1364 s14, docs:
-- .omni-loop/delivery/inbox/1364-product-home/spec.md §1). The contract step of
-- 20261129090000_product_repositories.sql: nothing reads repositories.product_id any more, so it goes,
-- with everything that kept it.
--
-- - repository_set_product() is dropped: product_repository_link() and product_repository_unlink() are
--   how a repository joins or leaves a product.
-- - The repositories_product_link trigger, which moved a repository's link whenever the column was
--   written, is dropped with its function.
-- - business_open() no longer points the workspace's repositories at the first product through the
--   column: it links each repository in no product to it (added_by = 'person'), as the trigger did when
--   it wrote the column.
-- - repositories.product_id is dropped. Every value it held was copied into a link by
--   20261129090000_product_repositories.sql and kept in step since, so no lookup changes.
-- (repositories_default_product and its trigger were dropped by 20261129090000_product_repositories.sql.)
--
-- Proven by supabase/checks/repositories.sql.
--
-- Rollback: a follow-up migration adds repositories.product_id back (uuid, references public.products
-- on delete set null), fills it from each repository's oldest link, and recreates
-- repository_set_product(), repositories_product_link() and its trigger as
-- 20261019090000_business_store.sql and 20261129090000_product_repositories.sql define them, with
-- business_open() as 20261019090000_business_store.sql defines it.

drop function public.repository_set_product(uuid, text, uuid);

drop trigger repositories_product_link on public.repositories;
drop function public.repositories_product_link();

-- As 20261019090000_business_store.sql: opens the workspace's business, made the first time with its
-- first product, both named after the workspace. Each repository of the workspace in no product is
-- linked to that product. Opened again, it answers the business as it is.
create or replace function public.business_open(p_workspace uuid) returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  made public.businesses;
  ws_name text;
  first_product uuid;
begin
  perform public.business_member_only(p_workspace);
  select w.name into ws_name from public.workspaces w where w.id = p_workspace;
  insert into public.businesses (workspace_id, name, created_by)
  values (p_workspace, ws_name, auth.uid())
  on conflict (workspace_id) do nothing
  returning * into made;
  if not found then
    return public.business_of(p_workspace);
  end if;
  insert into public.products (workspace_id, business_id, name, created_by)
  values (p_workspace, made.id, ws_name, auth.uid())
  returning id into first_product;
  insert into public.product_repositories (product_id, workspace_id, repository, added_by)
  select first_product, r.workspace_id, r.full_name, 'person'
    from public.repositories r
   where r.workspace_id = p_workspace
     and not exists (select 1 from public.product_repositories l where l.workspace_id = r.workspace_id and l.repository = r.full_name);
  return made;
end;
$$;

alter table public.repositories drop column product_id;
