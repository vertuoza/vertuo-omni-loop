-- Archive a product (PRD 2232 s1, docs: .omni-loop/delivery/inbox/2232-archive-product/spec.md).
--
-- A workspace owner archives a product: it is hidden and no endpoint answers for it any more; nothing is
-- erased, and Restore brings it back as it was.
--
-- - products.archived_at and products.archived_by: when, and by whom, an owner archived it; both null while
--   it is live (as repositories.removed_at, 20261215090000_remove_repository.sql).
-- - product_archive(product) and product_restore(product): an owner of the workspace only (42501 signed out
--   or not an owner, P0002 no such product). Archive sets both columns, restore clears them; archiving an
--   archived product, or restoring a live one, answers the row as it is. Each answers {id, name, archivedAt}.
-- - The products select policy: a member reads a live product of their workspace; an owner of the
--   workspace also reads its archived ones.
-- - Every lookup that resolves a product for the kit or an agent skips an archived product, for everyone,
--   owners included: repository_only_product() and lookup_product() (and through them constituents_for_repo(),
--   pitch_look_for_repo(), pitch_settings_for_repo(), claim_answer(), business_for_repo_app(),
--   constituents_for_repo_app(), the first version's and an idea's product), business_for_product(),
--   business_first_product(), agent_question_product() and knowledge_graph_push()'s products list. A product
--   the caller named, by key or by id, is refused with P0002 `Product <name> is archived: an owner restores it
--   on its page.`: product_of_key() (dossier, roadmap and bug pushes), business_product() (and through it
--   product_knowledge_product(), so product_knowledge_of(), Legal, glossary, owners and proposals, and the
--   personas, Never lines, claims, pitch and name), product_knowledge_entry_product(),
--   product_knowledge_open(), product_repository_owned() (links, key, plan repository, steps),
--   product_approver_set() and product_approver_remove(), dossier_set_product(), and a roadmap push naming
--   it. A PRD push whose product is archived links no repository to it, and a push naming a product among a
--   repository's several picks among the live ones only.
-- - A repository's links to an archived product are kept, so restore brings them back; while it is
--   archived they are ignored: the repository resolves to its other products, or to none. Where a
--   repository (or the PRD named in it) resolves to an archived product and nothing else, the reads say so
--   in words, never with an empty answer: business_for_repo() and business_for_token() answer
--   {state: 'archived', business: {name}, product: {name}} with empty lists, and knowledge_graph_for_token()
--   refuses with the P0002 above. Without a repository, a link whose business sells only archived products,
--   one of them, reads it the same way.
--
-- Proven by supabase/checks/product_archive.sql; the earlier checks still pass unchanged.
--
-- Rollback (the down script): a follow-up migration that sets archived_at and archived_by to null on every
-- product, restores the functions below from their last migrations (20261129090000_product_repositories.sql,
-- 20261129100000_prd_product.sql, 20261129110000_product_lookups.sql, 20261203100000_product_prd_ids.sql,
-- 20261212110000_product_knowledge.sql, 20261215100000_knowledge_graphs.sql,
-- 20261216090000_knowledge_graph_for_token.sql, 20261019090000_business_store.sql,
-- 20261124090000_product_approvers.sql, 20261110090000_roadmaps.sql and the dossier migrations that last
-- defined dossier_push(), dossier_set_product() and dossier_link_repositories()), sets the products select
-- policy back to `workspace_id in (select public.my_workspaces())`, drops product_archive(),
-- product_restore(), product_owner_of(), product_live(), product_archived_for() and business_archived(),
-- then the two columns. Nothing was deleted, so nothing is lost.

-- ── The columns ──────────────────────────────────────────────────────────────────

alter table public.products
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users on delete set null,
  add constraint products_archived_by_check check (archived_at is not null or archived_by is null);

comment on column public.products.archived_at is
  'PRD 2232: when an owner archived the product, null while it is live. Archived, it leaves every member''s reads and every lookup; nothing under it is erased. Set and cleared only by product_archive() and product_restore().';
comment on column public.products.archived_by is
  'PRD 2232: the owner who archived the product; null while it is live, or once their account is deleted.';

-- ── Helpers ──────────────────────────────────────────────────────────────────────

-- The product, when it is live; P0002 naming it when it is archived. A null product passes through.
create function public.product_live(p public.products) returns public.products
language plpgsql stable
set search_path = ''
as $$
begin
  if p.archived_at is not null then
    raise exception 'Product % is archived: an owner restores it on its page.', p.name using errcode = 'P0002', hint = 'product';
  end if;
  return p;
end;
$$;

-- The product, locked, when the caller owns its workspace, archived or not. 42501 signed out or not an owner
-- (`Only an owner of the workspace <act> <name>.`), P0002 no such product.
create function public.product_owner_of(p_product uuid, p_act text) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select p.* into owned from public.products p where p.id = p_product for update;
  if not found then
    raise exception 'Product: no such product.' using errcode = 'P0002', hint = 'product';
  end if;
  if not public.is_owner(owned.workspace_id) then
    raise exception 'Only an owner of the workspace % %.', p_act, owned.name using errcode = '42501';
  end if;
  return owned;
end;
$$;

-- As 20261129090000_product_repositories.sql, refusing an archived product: links, key, plan repository
-- and steps change only on a live product.
create or replace function public.product_repository_owned(p_product uuid) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.product_live(public.product_owner_of(p_product, 'changes the repositories of'));
end;
$$;

-- ── Archive and restore ──────────────────────────────────────────────────────────

-- An owner archives the product: {id, name, archivedAt}. Archiving an archived product answers it as it is.
create function public.product_archive(p_product uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products := public.product_owner_of(p_product, 'archives');
begin
  if owned.archived_at is null then
    update public.products p set archived_at = now(), archived_by = (select auth.uid())
     where p.id = owned.id
     returning * into owned;
  end if;
  return jsonb_build_object('id', owned.id, 'name', owned.name, 'archivedAt', owned.archived_at);
end;
$$;

-- An owner restores the product as it was: {id, name, archivedAt: null}. Restoring a live one answers it.
create function public.product_restore(p_product uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products := public.product_owner_of(p_product, 'restores');
begin
  if owned.archived_at is not null then
    update public.products p set archived_at = null, archived_by = null
     where p.id = owned.id
     returning * into owned;
  end if;
  return jsonb_build_object('id', owned.id, 'name', owned.name, 'archivedAt', owned.archived_at);
end;
$$;

-- ── Who reads it ─────────────────────────────────────────────────────────────────

-- A member reads a live product of their workspace; an owner of the workspace also reads its archived ones.
alter policy "a member reads their workspace's products" on public.products
  using ((workspace_id in (select public.my_workspaces())) and (archived_at is null or public.is_owner(workspace_id)));

-- ── The lookups: an archived product is skipped ──────────────────────────────────

-- As 20261129100000_prd_product.sql, over the links to live products only.
create or replace function public.repository_only_product(p_workspace uuid, p_repo text) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then min(l.product_id::text)::uuid end
    from public.product_repositories l
    join public.products p on p.id = l.product_id
   where l.workspace_id = p_workspace and l.repository = p_repo and p.archived_at is null
$$;

-- As 20261129110000_product_lookups.sql: a PRD whose product is archived reads none.
create or replace function public.lookup_product(p_workspace uuid, p_repo text, p_prd integer default null) returns uuid
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  target public.dossiers;
begin
  if p_workspace is null then
    return null;
  end if;
  if p_prd is not null then
    select d.* into target from public.dossiers d
     where d.workspace_id = p_workspace and d.home_repo = v_repo and d.kind = 'prd' and d.prd = p_prd;
    if target.id is not null then
      return (select p.id from public.products p where p.id = target.product_id and p.archived_at is null);
    end if;
  end if;
  return public.repository_only_product(p_workspace, v_repo);
end;
$$;

-- The archived product a lookup in `p_repo` for PRD `p_prd` would have read were it live: the PRD's own
-- when the workspace holds the PRD and its product is archived, else the repository's only product when
-- its links name exactly one, archived. Null otherwise. Internal.
create function public.product_archived_for(p_workspace uuid, p_repo text, p_prd integer default null) returns public.products
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  target public.dossiers;
  found_one public.products;
begin
  if p_workspace is null then
    return null;
  end if;
  if p_prd is not null then
    select d.* into target from public.dossiers d
     where d.workspace_id = p_workspace and d.home_repo = v_repo and d.kind = 'prd' and d.prd = p_prd;
    if target.id is not null then
      select p.* into found_one from public.products p where p.id = target.product_id and p.archived_at is not null;
      return found_one;
    end if;
  end if;
  select p.* into found_one from public.products p
   where p.archived_at is not null
     and p.id = (select case when count(*) = 1 then min(l.product_id::text)::uuid end
                   from public.product_repositories l
                  where l.workspace_id = p_workspace and l.repository = v_repo);
  return found_one;
end;
$$;

-- As 20261203100000_product_prd_ids.sql, refusing an archived product: a key always names its product.
create or replace function public.product_of_key(p_key text, p_repo text default null) returns public.products
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one public.products;
begin
  select p.* into found_one
    from public.products p
    join public.workspaces w on w.id = p.workspace_id
   where p.key = btrim(coalesce(p_key, '')) and public.is_member(p.workspace_id)
   order by (exists (select 1 from public.repositories r
                      where r.workspace_id = p.workspace_id and r.full_name = lower(btrim(coalesce(p_repo, ''))))
             or lower(w.github_org) is not distinct from nullif(lower(split_part(btrim(coalesce(p_repo, '')), '/', 1)), '')) desc,
            p.created_at, p.id
   limit 1;
  return public.product_live(found_one);
end;
$$;

-- As 20261019090000_business_store.sql, refusing an archived product: every change to a product's
-- content named by id (its knowledge, personas, Never lines, claims, pitch, name) goes through here.
create or replace function public.business_product(p_workspace uuid, p_product uuid) returns public.products
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one public.products;
begin
  select * into found_one from public.products p where p.id = p_product and p.workspace_id = p_workspace;
  if not found then
    raise exception 'Product: no such product in this workspace.' using errcode = 'P0002', hint = 'product';
  end if;
  return public.product_live(found_one);
end;
$$;

-- As 20261019090000_business_store.sql, among the live products.
create or replace function public.business_first_product(p_workspace uuid) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select p.id from public.products p where p.workspace_id = p_workspace and p.archived_at is null order by p.ordinal limit 1
$$;

-- As 20261129110000_product_lookups.sql: a live product named, else the repository's only live product,
-- else the workspace's only live product.
create or replace function public.agent_question_product(q public.agent_questions, p_product uuid) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.products p where p.id = p_product and p.workspace_id = q.workspace_id and p.archived_at is null),
    public.repository_only_product(q.workspace_id, q.repo),
    (select min(p.id::text)::uuid from public.products p where p.workspace_id = q.workspace_id and p.archived_at is null
      having count(*) = 1))
$$;

-- ── What the kit and agents read ─────────────────────────────────────────────────

-- As 20261212110000_product_knowledge.sql, over the live products: an archived product reads as none, and
-- is not counted among the business's products.
create or replace function public.business_for_product(p_workspace uuid, p_product uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  biz public.businesses;
  product public.products;
  products_count integer;
  listed jsonb;
  cast_of jsonb;
begin
  select * into biz from public.businesses b where b.workspace_id = p_workspace;
  if not found then
    return jsonb_build_object('state', 'none', 'business', null, 'product', null, 'claims', '[]'::jsonb, 'personas', '[]'::jsonb,
                              'legal', '[]'::jsonb, 'glossary', '[]'::jsonb);
  end if;
  select p.* into product from public.products p where p.id = p_product and p.business_id = biz.id and p.archived_at is null;
  select count(*) into products_count from public.products p where p.business_id = biz.id and p.archived_at is null;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.kind || '#' || c.seq, 'kind', c.kind, 'value', c.value, 'source', c.source, 'state', c.state,
           'receipt', coalesce(
             (select x.location || ' — "' || x.quote || '"' from public.claim_receipts x
               where x.claim_id = c.id order by x.seen_at desc, x.id desc limit 1),
             c.receipt),
           'lastSeen', c.last_seen) order by c.seq), '[]'::jsonb)
    into listed
    from public.claims c
   where c.business_id = biz.id and c.state in ('confirmed', 'contradicted')
     and (c.product_id is null or c.product_id = product.id);
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.name, 'stance', p.stance, 'trade', p.trade, 'who', p.who, 'usage', p.usage) order by p.ordinal), '[]'::jsonb)
    into cast_of
    from public.personas p
   where p.product_id = product.id and p.deleted_at is null;
  return jsonb_build_object(
    'state', case when jsonb_array_length(listed) = 0 then 'none' else 'ok' end,
    'business', jsonb_build_object('name', biz.name),
    'product', case when products_count > 1 and product.id is not null then jsonb_build_object('name', product.name) end,
    'claims', listed,
    'personas', cast_of)
    || public.product_knowledge_for_agents(product.id);
end;
$$;

-- What a read answers for an archived product: its business's and its own name, and nothing of it.
-- Internal.
create function public.business_archived(p_workspace uuid, p public.products) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'state', 'archived',
    'business', (select jsonb_build_object('name', b.name) from public.businesses b where b.workspace_id = p_workspace),
    'product', jsonb_build_object('name', p.name),
    'claims', '[]'::jsonb, 'personas', '[]'::jsonb, 'legal', '[]'::jsonb, 'glossary', '[]'::jsonb)
$$;

-- As 20261129110000_product_lookups.sql: a repository (or a PRD of it) whose product is archived, and
-- nothing else, reads `archived`.
create or replace function public.business_for_repo(p_repo text, p_prd integer default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  product uuid := public.lookup_product(ws, p_repo, p_prd);
  archived public.products;
begin
  if product is null then
    archived := public.product_archived_for(ws, p_repo, p_prd);
    if archived.id is not null then
      return public.business_archived(ws, archived);
    end if;
  end if;
  return public.business_for_product(ws, product);
end;
$$;

-- As 20261129110000_product_lookups.sql, over the live products: a repository whose product is archived,
-- and nothing else, reads `archived`; without a repository, a business whose only products are archived,
-- one of them, reads it the same way.
create or replace function public.business_for_token(p_hash text, p_repo text default null, p_prd integer default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens := public.agent_token_of(p_hash);
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  org text;
  product uuid;
  products_count integer;
  archived public.products;
begin
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.agent_tokens x set last_used_at = now() where x.id = t.id;
  end if;

  if v_repo <> '' then
    if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
      raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
    end if;
    select lower(w.github_org) into org from public.workspaces w where w.id = t.workspace_id;
    if not exists (select 1 from public.repositories r where r.workspace_id = t.workspace_id and r.full_name = v_repo)
       and org is distinct from split_part(v_repo, '/', 1) then
      raise exception 'Repository: % is not one of this workspace''s repositories.', v_repo using errcode = '42501', hint = 'repo';
    end if;
    product := public.lookup_product(t.workspace_id, v_repo, p_prd);
    if product is null then
      archived := public.product_archived_for(t.workspace_id, v_repo, p_prd);
      if archived.id is not null then
        return public.business_archived(t.workspace_id, archived);
      end if;
    end if;
    return public.business_for_product(t.workspace_id, product);
  end if;

  if p_prd is not null then
    raise exception 'Repository: a PRD is read in its repository, so name it too.' using errcode = '22023', hint = 'repo';
  end if;
  select count(*), min(p.id::text)::uuid into products_count, product
    from public.products p join public.businesses b on b.id = p.business_id
   where b.workspace_id = t.workspace_id and p.archived_at is null;
  if products_count = 0 then
    select p.* into archived from public.products p join public.businesses b on b.id = p.business_id
     where b.workspace_id = t.workspace_id and p.archived_at is not null
     order by p.ordinal limit 1;
    if archived.id is not null then
      return public.business_archived(t.workspace_id, archived);
    end if;
  end if;
  return public.business_for_product(t.workspace_id, case when products_count = 1 then product end);
end;
$$;

-- As 20261216090000_knowledge_graph_for_token.sql, over the live products: a repository whose product is
-- archived, and nothing else, is refused with the archived P0002; without a repository, so is a business
-- whose only products are archived.
create or replace function public.knowledge_graph_for_token(p_hash text, p_repo text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t              public.agent_tokens := public.agent_token_of(p_hash);
  v_repo         text := lower(btrim(coalesce(p_repo, '')));
  org            text;
  products_count integer;
  tracked        text;
  v_product      uuid;
  product        public.products;
begin
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.agent_tokens x set last_used_at = now() where x.id = t.id;
  end if;

  if v_repo <> '' then
    if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
      raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
    end if;
    select lower(w.github_org) into org from public.workspaces w where w.id = t.workspace_id;
    if not exists (select 1 from public.repositories r where r.workspace_id = t.workspace_id and r.full_name = v_repo)
       and org is distinct from split_part(v_repo, '/', 1) then
      raise exception 'Repository: % is not one of this workspace''s repositories.', v_repo using errcode = '42501', hint = 'repo';
    end if;
    v_product := public.lookup_product(t.workspace_id, v_repo, null);
    if v_product is null then
      perform public.product_live(public.product_archived_for(t.workspace_id, v_repo, null));
      raise exception 'Repository: % is not in exactly one product of this workspace, so it has no product knowledge graph.', v_repo
        using errcode = '22023', hint = 'repo';
    end if;
  else
    select count(*), min(p.id::text)::uuid into products_count, v_product
      from public.products p join public.businesses b on b.id = p.business_id
     where b.workspace_id = t.workspace_id and p.archived_at is null;
    if products_count = 0 then
      select p.* into product from public.products p join public.businesses b on b.id = p.business_id
       where b.workspace_id = t.workspace_id and p.archived_at is not null
       order by p.ordinal limit 1;
      perform public.product_live(product);
    end if;
    if products_count <> 1 then
      select string_agg(r.full_name, ', ' order by r.full_name) into tracked
        from public.repositories r where r.workspace_id = t.workspace_id and r.tracked;
      raise exception '%', case
          when products_count = 0 then 'This workspace has no product yet, so it has no knowledge graph.'
          else format('Repository: this workspace sells several products, so name the repository you work in: %s.', coalesce(tracked, 'none tracked'))
        end
        using errcode = '22023', hint = 'repo';
    end if;
  end if;

  select p.* into product from public.products p where p.id = v_product and p.workspace_id = t.workspace_id;
  if not found then
    raise exception 'This workspace has no product yet, so it has no knowledge graph.' using errcode = '22023', hint = 'repo';
  end if;

  return jsonb_build_object(
    'product', jsonb_build_object('id', product.id, 'key', product.key, 'name', product.name),
    'links', (select coalesce(jsonb_agg(jsonb_build_object('repository', l.repository, 'knowledge', l.knowledge)
                                        order by l.repository), '[]'::jsonb)
                from public.product_repositories l
               where l.product_id = product.id and l.workspace_id = t.workspace_id),
    'legal', (select coalesce(jsonb_agg(jsonb_build_object('code', x.code, 'number', x.number, 'statement', x.statement,
                                                           'retired_at', x.retired_at)
                                        order by x.code, x.number), '[]'::jsonb)
                from public.product_legal x
               where x.product_id = product.id and x.workspace_id = t.workspace_id),
    'glossary', (select coalesce(jsonb_agg(jsonb_build_object('term', g.term, 'meaning', g.meaning, 'removed_at', g.removed_at)
                                           order by g.term), '[]'::jsonb)
                   from public.product_glossary g
                  where g.product_id = product.id and g.workspace_id = t.workspace_id),
    'never', (select coalesce(jsonb_agg(jsonb_build_object('seq', c.seq, 'body', c.body, 'removed_at', c.removed_at)
                                        order by c.seq), '[]'::jsonb)
                from public.constituents c
               where c.product_id = product.id and c.workspace_id = t.workspace_id and c.kind = 'never'),
    'graphs', (select coalesce(jsonb_agg(jsonb_build_object('repository', k.repository, 'sha', k.sha, 'graph', k.graph,
                                                            'pushed_at', k.pushed_at, 'pushed_by_login', k.pushed_by_login)
                                         order by k.repository), '[]'::jsonb)
                 from public.product_repositories l
                 cross join lateral (
                   select g.* from public.knowledge_graphs g
                    where g.repository = l.repository
                    order by g.pushed_at desc
                    limit 1) k
                where l.product_id = product.id and l.workspace_id = t.workspace_id and l.knowledge = 'own'));
end;
$$;

-- As 20261215100000_knowledge_graphs.sql: the products answered are the live ones.
create or replace function public.knowledge_graph_push(p_repo text, p_sha text, p_graph jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller   uuid := (select auth.uid());
  v_repo   text := lower(btrim(coalesce(p_repo, '')));
  v_sha    text := lower(btrim(coalesce(p_sha, '')));
  v_login  text;
  kept     public.knowledge_graphs;
  products jsonb;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_repo !~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Commit: the full 40-character sha.' using errcode = '22023', hint = 'commit';
  end if;
  if p_graph is null or jsonb_typeof(p_graph) <> 'object' or p_graph ->> 'shape' is distinct from 'repository'
     or jsonb_typeof(p_graph -> 'nodes') is distinct from 'array' or jsonb_typeof(p_graph -> 'edges') is distinct from 'array' then
    raise exception 'Graph: a repository''s graph, with its nodes and edges.' using errcode = '22023', hint = 'graph';
  end if;
  if octet_length(p_graph::text) > 2097152 then
    raise exception 'Graph: 2 MiB at most.' using errcode = '22023', hint = 'graph';
  end if;
  if not exists (select 1 from public.repositories r
                  join public.workspace_members m on m.workspace_id = r.workspace_id
                 where r.full_name = v_repo and m.user_id = caller) then
    raise exception 'You are not a member of a workspace that tracks %.', v_repo using errcode = '42501', hint = 'repo';
  end if;

  select lower(coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')) into v_login
    from auth.identities i
   where i.user_id = caller and i.provider = 'github'
   order by i.created_at
   limit 1;

  -- One push of a repository at a time, so the 20 kept are counted once.
  perform pg_advisory_xact_lock(hashtextextended('knowledge_graphs:' || v_repo, 0));

  insert into public.knowledge_graphs as g (repository, sha, graph, pushed_at, pushed_by, pushed_by_login)
  values (v_repo, v_sha, p_graph, clock_timestamp(), caller, v_login)
  on conflict (repository, sha) do update
     set graph = excluded.graph, pushed_at = excluded.pushed_at, pushed_by = excluded.pushed_by,
         pushed_by_login = excluded.pushed_by_login
  returning * into kept;

  delete from public.knowledge_graphs g
   where g.repository = v_repo
     and g.sha not in (select k.sha from public.knowledge_graphs k where k.repository = v_repo
                        order by k.pushed_at desc, k.sha limit 20);

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'key', p.key) order by p.key nulls last, p.name, p.id), '[]'::jsonb)
    into products
    from public.product_repositories l
    join public.products p on p.id = l.product_id
   where l.repository = v_repo and l.knowledge = 'own' and p.archived_at is null
     and l.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = caller);

  return jsonb_build_object(
    'repository', kept.repository, 'sha', kept.sha,
    'nodes', jsonb_array_length(kept.graph -> 'nodes'), 'edges', jsonb_array_length(kept.graph -> 'edges'),
    'pushedAt', kept.pushed_at, 'products', products);
end;
$$;

-- ── What changes a product's content: an archived product is refused ─────────────

-- As 20261212110000_product_knowledge.sql, refusing an entry of an archived product.
create or replace function public.product_knowledge_entry_product(p_workspace uuid, p_kind text, p_entry uuid) returns public.products
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one public.products;
begin
  perform public.product_knowledge_member_only(p_workspace);
  select p.* into found_one from public.products p
   where p.id = case when p_kind = 'legal'
                     then (select l.product_id from public.product_legal l where l.id = p_entry and l.workspace_id = p_workspace)
                     else (select g.product_id from public.product_glossary g where g.id = p_entry and g.workspace_id = p_workspace) end;
  if not found then
    raise exception 'Entry: no such entry in this workspace.' using errcode = 'P0002', hint = 'entry';
  end if;
  return public.product_live(found_one);
end;
$$;

-- As 20261212110000_product_knowledge.sql, refusing a proposal of an archived product.
create or replace function public.product_knowledge_open(p_workspace uuid, p_proposal uuid) returns public.product_knowledge_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_one public.product_knowledge_proposals;
begin
  perform public.product_knowledge_member_only(p_workspace);
  select * into found_one from public.product_knowledge_proposals x
   where x.id = p_proposal and x.workspace_id = p_workspace and x.state = 'open'
   for update;
  if not found then
    raise exception 'Proposal: no such open proposal in this workspace.' using errcode = 'P0002', hint = 'proposal';
  end if;
  perform public.product_live(p) from public.products p where p.id = found_one.product_id;
  perform public.product_knowledge_decider_only(found_one.product_id, found_one.kind);
  return found_one;
end;
$$;

-- As 20261124090000_product_approvers.sql, refusing an archived product.
create or replace function public.product_approver_set(p_product uuid, p_member uuid, p_state text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select p.* into owned from public.products p where p.id = p_product for update;
  if not found then
    raise exception 'No such product.' using errcode = 'P0002';
  end if;
  if not public.is_owner(owned.workspace_id) then
    raise exception 'Only an owner of the workspace lists % approvers.', owned.name using errcode = '42501';
  end if;
  owned := public.product_live(owned);
  if p_state is null or p_state not in ('asked', 'skipped') then
    raise exception 'An approver is asked or skipped.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = owned.workspace_id and m.user_id = p_member) then
    raise exception 'That account is not a member of the workspace that owns %.', owned.name using errcode = '22023';
  end if;
  insert into public.product_approvers (workspace_id, product_id, user_id, state, set_by)
  values (owned.workspace_id, owned.id, p_member, p_state, (select auth.uid()))
  on conflict (product_id, user_id) do update
    set state = excluded.state, set_by = excluded.set_by, set_at = now();
  return jsonb_build_object('product', owned.id, 'member', p_member, 'state', p_state);
end;
$$;

-- As 20261124090000_product_approvers.sql, refusing an archived product.
create or replace function public.product_approver_remove(p_product uuid, p_member uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select p.* into owned from public.products p where p.id = p_product for update;
  if not found then
    raise exception 'No such product.' using errcode = 'P0002';
  end if;
  if not public.is_owner(owned.workspace_id) then
    raise exception 'Only an owner of the workspace lists % approvers.', owned.name using errcode = '42501';
  end if;
  owned := public.product_live(owned);
  delete from public.product_approvers a where a.product_id = owned.id and a.user_id = p_member;
  return found;
end;
$$;

-- As its last migration, refusing to put a PRD on an archived product.
create or replace function public.dossier_set_product(p_dossier uuid, p_product uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target  public.dossiers;
  product public.products;
  latest  uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target from public.dossiers d
   where d.id = p_dossier and public.is_member(d.workspace_id)
     for update;
  if target.id is null then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  if p_product is not null then
    select p.* into product from public.products p where p.id = p_product and p.workspace_id = target.workspace_id;
    if product.id is null then
      raise exception 'Product: no such product in this workspace.' using errcode = 'P0002', hint = 'product';
    end if;
    product := public.product_live(product);
  end if;
  if target.product_id is distinct from p_product then
    select a.id into latest from public.approvals a
     where a.dossier_id = target.id
     order by a.approved_at desc, a.id desc
     limit 1;
    if latest is not null and not exists (select 1 from public.approval_voids x where x.approval_id = latest) then
      raise exception 'product is locked: PRD % is approved', target.prd using errcode = '55000', hint = 'product';
    end if;
    update public.dossiers d set product_id = p_product where d.id = target.id;
    perform public.dossier_link_repositories(target.id);
  end if;
  return jsonb_build_object('id', target.id,
    'product', case when product.id is not null then jsonb_build_object('id', product.id, 'name', product.name) end);
end;
$$;

-- As its last migration: a PRD whose product is archived links no repository to it.
create or replace function public.dossier_link_repositories(p_dossier uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target  public.dossiers;
  v_repos text[];
begin
  select d.* into target from public.dossiers d where d.id = p_dossier;
  if target.id is null then
    return;
  end if;
  v_repos := public.dossier_write_targets(target.id);
  if target.product_id is null
     or exists (select 1 from public.products p where p.id = target.product_id and p.archived_at is not null) then
    return;
  end if;

  insert into public.product_repositories (product_id, workspace_id, repository, added_by)
  select distinct target.product_id, target.workspace_id, r.full_name, 'prd'
    from public.repositories r
   where r.workspace_id = target.workspace_id and r.full_name = any (array[target.home_repo] || v_repos)
  on conflict (product_id, repository) do nothing;
end;
$$;

-- As its last migration: a push naming a product among its repository's several picks among the live ones.
create or replace function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb, p_kind text default 'prd',
  p_product text default null, p_product_key text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_title   text := btrim(coalesce(p_title, ''));
  v_kind    text := coalesce(p_kind, 'prd');
  v_product text := lower(btrim(coalesce(p_product, '')));
  v_key     text := btrim(coalesce(p_product_key, ''));
  v_seq     integer;
  keyed     public.products%rowtype;
  pick      record;
  draft     public.dossiers%rowtype;
  target    public.dossiers%rowtype;
  item      jsonb;
  kinds     text[] := '{}';
  v_version integer;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
  in_force  public.approvals%rowtype;
  pinned    text;
  latest    public.dossier_versions%rowtype;
  named     uuid;
  product   public.products%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_kind not in ('prd', 'visual', 'bug', 'concept') then
    raise exception 'A dossier''s kind is prd, visual, bug or concept.' using errcode = '22023';
  end if;
  if v_key <> '' then
    if v_kind <> 'prd' or p_draft is not null or v_product <> '' then
      raise exception 'A product PRD is a PRD of its product alone: no draft, no other kind, no product name.' using errcode = '22023';
    end if;
    if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
      raise exception 'A product key is lowercase kebab-case, as mobile.' using errcode = '22023';
    end if;
    if v_repo <> '' and (v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200) then
      raise exception 'A push names its repository as owner/name.' using errcode = '22023';
    end if;
    if p_prd is not null and p_prd <= 0 then
      raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
    end if;
  else
    if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
      raise exception 'A push names its repository as owner/name.' using errcode = '22023';
    end if;
    if p_prd is null or p_prd <= 0 then
      raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
    end if;
  end if;
  if char_length(v_title) not between 1 and 200 then
    raise exception 'A push carries a title of 1 to 200 characters.' using errcode = '22023';
  end if;
  if p_artifacts is null or jsonb_typeof(p_artifacts) <> 'array' then
    raise exception 'The artifacts are a list of {kind, content}.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_artifacts) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item ->> 'kind', '') not in ('spec', 'plan', 'before-after', 'variations', 'bug-record', 'voice', 'concept-record', 'vision', 'board', 'debate')
       or jsonb_typeof(item -> 'content') is distinct from 'string' then
      raise exception 'Each artifact is {kind, content}, its kind one of spec, plan, before-after, variations, bug-record, voice, concept-record, vision, board, debate.' using errcode = '22023';
    end if;
    if (item ->> 'kind') not in ('variations', 'board') and (item ->> 'kind') = any (kinds) then
      raise exception 'Each kind is sent once: % came twice.', item ->> 'kind' using errcode = '22023';
    end if;
    if not public.dossier_takes(v_kind, item ->> 'kind') then
      raise exception 'A % dossier takes no % version.', v_kind, item ->> 'kind' using errcode = '22023';
    end if;
    kinds := kinds || (item ->> 'kind');
  end loop;

  if v_key <> '' then
    keyed := public.product_of_key(v_key, v_repo);
    if keyed.id is null then
      raise exception 'No product keyed % in your workspaces.', v_key using errcode = 'P0002';
    end if;
    if p_prd is null then
      -- The product's row is locked until this push commits: the next create waits, then takes the next
      -- number. A push rolled back takes its number back with it.
      update public.products p set prd_count = p.prd_count + 1 where p.id = keyed.id returning p.prd_count into v_seq;
      insert into public.dossiers (workspace_id, home_repo, kind, product_id, product_seq, title, opened_by, numbered_at, birthplace)
      values (keyed.workspace_id, null, 'prd', keyed.id, v_seq, v_title, caller, now(), 'server')
      returning * into target;
    else
      select d.* into target from public.dossiers d
       where d.product_id = keyed.id and d.product_seq = p_prd and d.kind = 'prd'
         for update;
      if not found then
        raise exception 'No PRD %-% on %.', v_key, p_prd, keyed.name using errcode = 'P0002';
      end if;
    end if;
  elsif p_draft is not null then
    if v_kind <> 'prd' then
      raise exception 'A % dossier has no draft: push it by its number alone.', v_kind using errcode = '22023';
    end if;
    select d.* into draft from public.dossiers d
     where d.id = p_draft and public.is_member(d.workspace_id)
       for update;
    if not found then
      raise exception 'No such draft dossier.' using errcode = 'P0002';
    end if;
    if draft.home_repo is distinct from v_repo then
      raise exception 'This draft belongs to %.', coalesce(draft.home_repo, 'its product') using errcode = '22023';
    end if;
    if draft.prd is not null and draft.prd <> p_prd then
      raise exception 'This dossier is already PRD #%.', draft.prd using errcode = '22023';
    end if;
    if draft.prd is not null then
      target := draft;
    else
      select d.* into target from public.dossiers d
       where d.workspace_id = draft.workspace_id and d.home_repo = v_repo and d.kind = 'prd' and d.prd = p_prd
         for update;
      if found then
        -- Numbered to a key already taken: the draft merges into that dossier, and goes.
        update public.dossier_versions v set dossier_id = target.id where v.dossier_id = draft.id;
        update public.dossiers d
           set claude_session_id = coalesce(draft.claude_session_id, d.claude_session_id),
               opened_by = coalesce(draft.opened_by, d.opened_by),
               created_at = least(d.created_at, draft.created_at)
         where d.id = target.id;
        delete from public.dossiers d where d.id = draft.id;
      else
        update public.dossiers d set prd = p_prd, numbered_at = now() where d.id = draft.id;
        target := draft;
      end if;
    end if;
  else
    select * into pick from public.repo_workspace(caller, v_repo);
    if pick.workspace_id is null then
      raise exception '%', pick.refusal using errcode = '42501';
    end if;
    insert into public.dossiers (workspace_id, home_repo, kind, prd, title, opened_by, numbered_at)
    values (pick.workspace_id, v_repo, v_kind, p_prd, v_title, caller, now())
    on conflict (workspace_id, home_repo, kind, prd) do nothing;
    select d.* into target from public.dossiers d
     where d.workspace_id = pick.workspace_id and d.home_repo = v_repo and d.kind = v_kind and d.prd = p_prd
       for update;
  end if;

  update public.dossiers d set title = v_title where d.id = target.id;

  -- Its birth, in a repository of several products: the one of them the push names. One product, or
  -- none, is the first version's to give (dossier_versions_product). A product PRD has its product.
  if v_product <> '' and target.product_id is null and target.home_repo is not null
     and not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id)
     and (select count(*) from public.product_repositories l
            join public.products p on p.id = l.product_id
           where l.workspace_id = target.workspace_id and l.repository = target.home_repo and p.archived_at is null) > 1 then
    select l.product_id into named
      from public.product_repositories l
      join public.products p on p.id = l.product_id
     where l.workspace_id = target.workspace_id and l.repository = target.home_repo and lower(p.name) = v_product
       and p.archived_at is null
     limit 1;
    if named is not null then
      update public.dossiers d set product_id = named where d.id = target.id;
    end if;
  end if;

  -- The approval in force before this push: the latest, unless a void follows it.
  select a.* into in_force
    from public.approvals a
   where a.dossier_id = target.id
   order by a.approved_at desc, a.id desc
   limit 1;
  if found and exists (select 1 from public.approval_voids x where x.approval_id = in_force.id) then
    in_force := null;
  end if;

  for item in select value from jsonb_array_elements(p_artifacts) loop
    v_version := public.dossier_add_version(target.id, item ->> 'kind', item ->> 'content', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item ->> 'kind');
    else
      added := added || jsonb_build_object('kind', item ->> 'kind', 'version', v_version);
      if in_force.id is not null then
        select f.value ->> 'sha256' into pinned
          from jsonb_array_elements(in_force.files) f
         where f.value ->> 'kind' = item ->> 'kind'
           and f.value ->> 'kind' <> 'voice'
         limit 1;
        if pinned is not null then
          select v.* into latest
            from public.dossier_versions v
           where v.dossier_id = target.id and v.kind = item ->> 'kind'
           order by v.created_at desc, v.id desc
           limit 1;
          if latest.sha256 <> pinned then
            insert into public.approval_voids (approval_id, dossier_id, kind, from_sha256, to_sha256, pushed_by, pusher_login, version_id)
            values (in_force.id, target.id, latest.kind, pinned, latest.sha256, caller,
                    public.member_login(target.workspace_id, caller), latest.id);
          end if;
        end if;
      end if;
    end if;
  end loop;

  -- Each push links the PRD's repositories again, even one whose link a person removed.
  perform public.dossier_link_repositories(target.id);

  select d.* into target from public.dossiers d where d.id = target.id;
  select p.* into product from public.products p where p.id = target.product_id;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged,
    'product', case when product.id is not null then jsonb_build_object('id', product.id, 'name', product.name) end)
    || case when target.product_seq is not null then jsonb_build_object('prdId', public.prd_id_of(target.product_id, target.product_seq)) else '{}'::jsonb end;
end;
$$;

-- As 20261110090000_roadmaps.sql's last version: a push naming an archived product is refused.
create or replace function public.roadmap_push(p_body jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  body      jsonb := coalesce(p_body, '{}'::jsonb);
  v_repo    text;
  v_product public.products;
  v_named   text;
  v_roadmap public.roadmaps;
  v_created boolean;
  pick      record;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if jsonb_typeof(body) <> 'object' then
    raise exception 'A push carries its fields as an object.' using errcode = '22023';
  end if;
  v_repo := lower(btrim(coalesce(body ->> 'repo', '')));
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'A roadmap names its repository as owner/name.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'prds') is distinct from 'array' or jsonb_typeof(body -> 'questions') is distinct from 'array' then
    raise exception 'A roadmap carries its PRDs and its questions.' using errcode = '22023';
  end if;
  if jsonb_array_length(body -> 'prds') > 200 then
    raise exception 'A roadmap holds 200 PRDs at most.' using errcode = '22023';
  end if;
  -- The human work: absent or null from a kit before it, else a list of at most 500 distinct keys.
  if jsonb_typeof(body -> 'humanWork') not in ('array', 'null') then
    raise exception 'A roadmap carries its human work as a list.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'humanWork') = 'array' then
    if jsonb_array_length(body -> 'humanWork') > 500 then
      raise exception 'A roadmap holds 500 pieces of human work at most.' using errcode = '22023';
    end if;
    if (select count(distinct e.value ->> 'key') from jsonb_array_elements(body -> 'humanWork') as e (value))
       <> jsonb_array_length(body -> 'humanWork') then
      raise exception 'A key of human work is used twice, or missing.' using errcode = '22023';
    end if;
  end if;

  select * into pick from public.repo_workspace(caller, v_repo);
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;

  -- The product, by name, among the workspace's own: a name that matches none files it under none.
  v_named := nullif(btrim(coalesce(body ->> 'product', '')), '');
  if v_named is not null then
    select * into v_product from public.products p
     where p.workspace_id = pick.workspace_id and lower(p.name) = lower(v_named)
     order by p.ordinal limit 1;
    v_product := public.product_live(v_product);
  end if;

  select * into v_roadmap from public.roadmaps r
   where r.workspace_id = pick.workspace_id and r.repo = v_repo and r.number = (body ->> 'number')::integer
   for update;
  v_created := v_roadmap.id is null;
  if v_created then
    insert into public.roadmaps (workspace_id, repo, number, title, milestone, product_id, target_date, source, questions, document, pushed_by)
    values (
      pick.workspace_id, v_repo, (body ->> 'number')::integer, btrim(body ->> 'title'), btrim(body ->> 'milestone'), v_product.id,
      (body ->> 'target')::date, nullif(btrim(body ->> 'source'), ''), body -> 'questions', body ->> 'document', caller
    )
    returning * into v_roadmap;
  else
    update public.roadmaps
       set title = btrim(body ->> 'title'), milestone = btrim(body ->> 'milestone'), product_id = v_product.id,
           target_date = (body ->> 'target')::date, source = nullif(btrim(body ->> 'source'), ''),
           questions = body -> 'questions', document = body ->> 'document', pushed_by = caller, pushed_at = now()
     where id = v_roadmap.id
     returning * into v_roadmap;
    delete from public.roadmap_prds where roadmap_id = v_roadmap.id;
  end if;

  insert into public.roadmap_prds (roadmap_id, position, row_id, prd, title, repos, blockers, wave, state, waits_on, waits_on_url, started_at, ended_at)
  select v_roadmap.id, e.ordinality::integer, e.value ->> 'id', (e.value ->> 'prd')::integer, btrim(e.value ->> 'title'),
         coalesce(array(select lower(jsonb_array_elements_text(coalesce(e.value -> 'repos', '[]'::jsonb)))), '{}'),
         coalesce(array(select jsonb_array_elements_text(coalesce(e.value -> 'blockers', '[]'::jsonb))), '{}'),
         (e.value ->> 'wave')::integer, e.value ->> 'state', nullif(btrim(e.value ->> 'waitsOn'), ''), e.value ->> 'waitsOnUrl',
         (e.value ->> 'startedAt')::timestamptz, (e.value ->> 'endedAt')::timestamptz
    from jsonb_array_elements(body -> 'prds') with ordinality as e (value, ordinality);

  -- Its human work, when the push carries the list: a new key stored with the kind the kit's rules gave
  -- it; a stored key keeps its kind (and who chose it), takes the push's text, act and link, and is open
  -- again; a key the push no longer carries is done, at this push. A done key stays done until it is back.
  if jsonb_typeof(body -> 'humanWork') = 'array' then
    insert into public.roadmap_human_work (roadmap_id, key, prd, repo, source, text, act, url, kind, kind_by)
    select v_roadmap.id, e.value ->> 'key', (e.value ->> 'prd')::integer, lower(btrim(e.value ->> 'repo')), e.value ->> 'source',
           btrim(e.value ->> 'text'), nullif(btrim(e.value ->> 'act'), ''), e.value ->> 'url', e.value ->> 'ruleKind', 'rule'
      from jsonb_array_elements(body -> 'humanWork') as e (value)
    on conflict (roadmap_id, key) do update
       set prd = excluded.prd, repo = excluded.repo, source = excluded.source, text = excluded.text, act = excluded.act,
           url = excluded.url, state = 'open', done_at = null;
    update public.roadmap_human_work h
       set state = 'done', done_at = now()
     where h.roadmap_id = v_roadmap.id and h.state = 'open'
       and not exists (select 1 from jsonb_array_elements(body -> 'humanWork') as e (value) where e.value ->> 'key' = h.key);
  end if;

  return jsonb_build_object(
    'roadmapId', v_roadmap.id,
    'created', v_created,
    'product', v_product.name,
    'unknownProduct', case when v_named is not null and v_product.id is null then v_named end
  );
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
    or not_null_violation or check_violation or unique_violation or foreign_key_violation then
    raise exception 'A roadmap''s fields are malformed: %', sqlerrm using errcode = '22023';
end;
$$;

-- ── Who runs what ────────────────────────────────────────────────────────────────

revoke execute on function public.product_live(public.products) from public, anon, authenticated;
revoke execute on function public.product_owner_of(uuid, text) from public, anon, authenticated;
revoke execute on function public.product_archived_for(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.business_archived(uuid, public.products) from public, anon, authenticated;
revoke execute on function public.product_archive(uuid) from public, anon;
grant execute on function public.product_archive(uuid) to authenticated;
revoke execute on function public.product_restore(uuid) from public, anon;
grant execute on function public.product_restore(uuid) to authenticated;
