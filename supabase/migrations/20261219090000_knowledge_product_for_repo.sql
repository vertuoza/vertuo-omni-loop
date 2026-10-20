-- The product a terminal's knowledge change lands on (PRD 2268 s1, docs:
-- .omni-loop/delivery/inbox/2268-terminal-knowledge-writes/spec.md).
--
-- `omni kb legal add`, `omni kb glossary edit`, `omni constituents add`… name their product by the
-- repository they run in, and, when it is in several, by the product's name. POST /api/knowledge/changes
-- asks this function which product that is, as the caller, then writes through the page's own functions
-- (product_legal_*, product_glossary_*, product_knowledge_propose(), constituent_add() and
-- constituent_edit()), which check who may change what, as they do for the Knowledge tab.
--
--   knowledge_product_for_repo(p_repo, p_product)   → {id, workspace, name}
--
-- - The workspace: the caller's for the repository (business_workspace(): 42501 signed out or another
--   workspace's repository, law BR-PRODUCT-63; 22023 a malformed one).
-- - The product: the one named (p_product, by its name or its key, without case) among the repository's
--   products, else the repository's only live product. An archived product is not counted, and naming one
--   is refused as every lookup refuses it (product_live(): P0002 `Product <name> is archived: …`); so is a
--   repository whose only product is archived. Several live products and none named: 21000, naming them in
--   their order. None: P0002. A name the repository has no product of: P0002, naming the ones it has.
--
-- Read only: it writes nothing, so the change it serves is recorded by the write functions, as the
-- caller's, as on the page.
--
-- Proven by supabase/checks/knowledge_product_for_repo.sql.
--
-- Rollback: a follow-up migration drops the function; nothing else reads it. No data changes.

create function public.knowledge_product_for_repo(p_repo text, p_product text default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  v_repo text := lower(btrim(p_repo));
  v_named text := nullif(btrim(coalesce(p_product, '')), '');
  live_count integer;
  live_names text;
  picked public.products;
begin
  select count(*), string_agg(p.name, ', ' order by p.ordinal, p.id)
    into live_count, live_names
    from public.product_repositories l
    join public.products p on p.id = l.product_id
   where l.workspace_id = ws and l.repository = v_repo and p.archived_at is null;

  if v_named is not null then
    -- A live product before an archived one of the same name.
    select p.* into picked
      from public.product_repositories l
      join public.products p on p.id = l.product_id
     where l.workspace_id = ws and l.repository = v_repo
       and (lower(p.name) = lower(v_named) or p.key = lower(v_named))
     order by p.archived_at nulls first, p.ordinal, p.id
     limit 1;
    if picked.id is null then
      raise exception 'Product: % is not one of %''s products (%).', v_named, v_repo, coalesce(live_names, 'none')
        using errcode = 'P0002', hint = 'product';
    end if;
    picked := public.product_live(picked);
  elsif live_count > 1 then
    raise exception '% is in % products: %; pass --product to name one.', v_repo, live_count, live_names
      using errcode = '21000', hint = 'product';
  elsif live_count = 1 then
    select p.* into picked
      from public.product_repositories l
      join public.products p on p.id = l.product_id
     where l.workspace_id = ws and l.repository = v_repo and p.archived_at is null;
  else
    perform public.product_live(public.product_archived_for(ws, v_repo));
    raise exception '% is in no product yet: link it on a product''s page.', v_repo using errcode = 'P0002', hint = 'repo';
  end if;

  return jsonb_build_object('id', picked.id, 'workspace', picked.workspace_id, 'name', picked.name);
end;
$$;

comment on function public.knowledge_product_for_repo(text, text) is
  'PRD 2268: the product a terminal''s knowledge change lands on, as the caller: the caller''s workspace for the repository, then the product named (by name or key) among its products, else its only live product. {id, workspace, name}; 21000 several and none named, P0002 none, not one of its products or archived, 42501 not the caller''s repository.';

revoke execute on function public.knowledge_product_for_repo(text, text) from public, anon;
grant execute on function public.knowledge_product_for_repo(text, text) to authenticated;
