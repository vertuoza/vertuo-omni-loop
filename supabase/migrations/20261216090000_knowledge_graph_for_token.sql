-- A product's knowledge graph, read by an agent's link (PRD 1798 s4, docs:
-- .omni-loop/delivery/inbox/1798-knowledge-graph-api/spec.md, "Any agent reads it").
--
-- The MCP link's read-only token is no Supabase session, so it reads neither knowledge_graphs nor P3's
-- tables through row-level security, as the read route's member does. knowledge_graph_for_token() reads
-- for it, as business_for_token() reads the business (ADR-0051): the token is checked by
-- agent_token_of() (28000 unknown, revoked, a kit token, or its maker left the workspace), and the
-- product is the one business_for_token() resolves, in the link's own workspace only (law BR-PRODUCT-63):
--   - with a repository: one the workspace lists or its GitHub organisation owns (42501 any other, named;
--     22023 malformed), and that repository's only product (22023 when it is in none or several);
--   - without: the business's only product (22023 naming the tracked repositories when it sells several,
--     and when it has none).
-- It answers what the read route's reader reads as a member, as the rows it reads them in, for the galaxy
-- to join and walk with the very code the route uses (apps/galaxy/src/knowledge-graph/join.ts, walk.ts):
--   {product: {id, key, name},
--    links:    [{repository, knowledge}]                         the product's links, by repository
--    legal:    [{code, number, statement, retired_at}]           every Legal entry, retired ones too
--    glossary: [{term, meaning, removed_at}]                     every term, removed ones too
--    never:    [{seq, body, removed_at}]                         every Never line, removed ones too
--    graphs:   [{repository, sha, graph, pushed_at, pushed_by_login}]}
-- `graphs` holds, for each link serving its own knowledge, its repository's graph pushed last: a link's
-- repository is always one its workspace lists (product_repositories' foreign key), so the link reads
-- exactly the graphs a member reads through row-level security; never another workspace's product, links
-- or knowledge. `last used` moves at most once a minute, as business_for_token() moves it.
--
-- Every change adds: one function. Nothing existing is changed or dropped.
--
-- Proven by supabase/checks/knowledge_graphs_link.sql.
--
-- Rollback (the down script): a follow-up migration that drops knowledge_graph_for_token(text, text),
-- after the MCP link's get_knowledge_graph stops calling it. No data changes.

create function public.knowledge_graph_for_token(p_hash text, p_repo text default null) returns jsonb
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
      raise exception 'Repository: % is not in exactly one product of this workspace, so it has no product knowledge graph.', v_repo
        using errcode = '22023', hint = 'repo';
    end if;
  else
    select count(*), min(p.id::text)::uuid into products_count, v_product
      from public.products p join public.businesses b on b.id = p.business_id
     where b.workspace_id = t.workspace_id;
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

comment on function public.knowledge_graph_for_token(text, text) is
  'PRD 1798: what an agent''s link reads of its product''s knowledge graph (the product business_for_token() resolves, its links, Legal entries, Glossary terms, Never lines and the latest graph of each own-knowledge repository its workspace lists), never another workspace''s. 28000 the link does not work, 42501 a repository not the workspace''s, 22023 no single product.';

-- ── Who may call it ──────────────────────────────────────────────────────────────

-- As business_for_token(): anyone holding a link's token, signed in or not; the token is the credential.
revoke execute on function public.knowledge_graph_for_token(text, text) from public;
grant execute on function public.knowledge_graph_for_token(text, text) to anon, authenticated;
