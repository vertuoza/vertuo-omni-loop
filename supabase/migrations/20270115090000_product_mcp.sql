-- A product's MCP server (PRD 2707 s2, docs: .omni-loop/delivery/inbox/2707-product-mcp/spec.md, "The store").
--
-- Each product may serve its knowledge to agents at /api/products/<key>/mcp, read with an API key the
-- workspace already has (`oma_…`, PRD 2022). The server is off until a workspace owner turns it on.
--
--   public.products.mcp_enabled          off by default; a member reads it with the product (the table's
--                                        select grant), so Product settings draws the card with no second
--                                        request; only product_mcp_set() writes it
--   product_mcp_set(product, on)         workspace owners only (42501 anyone else, signed out included;
--                                        P0002 no such product, or an archived one: PRD 2232, archived is
--                                        read-only; 22023 `on` missing). Answers the new state; turning it
--                                        on twice changes nothing
--   product_mcp_for_key(hash, key)       service role only, as api_key_of() is (the route's check). Answers
--                                        `{product: {id, key, name, workspace_id}, repositories: [{repo,
--                                        pack_id, sha, committed_at}], law_home, knowledge}`, or null
--
-- product_mcp_for_key() answers only while all of these hold, and null for anything else:
-- - the hash names a live API key whose maker is still a member of its workspace (api_key_of(), which also
--   moves last_used_at at most once a minute): BR-PRODUCT-64 and BL-ACCESS-1. Nothing is kept between
--   calls, so the moment the maker leaves, the next call reads nothing;
-- - the product of that key is in the key's own workspace (BR-PRODUCT-63), not archived, and its server
--   is on;
-- - the key's allow-list is empty, or names at least one of the product's repositories.
-- `repositories` are the product's repositories the key may read (all of them for an empty allow-list,
-- else only those it names), in name order, each with its newest knowledge pack, the pack fields null
-- when none was kept yet. `law_home` is the product's law home (product_law_home()) in the same shape,
-- whatever the allow-list, since business laws belong to the product, not to one repository; null when
-- the product has none. `knowledge` is product_knowledge_for_agents() of the product (its Legal entries with
-- each owner's login, its Glossary, its domains and its law home), exactly as the agent link reads them,
-- whole for any key that reaches the product (PRD 2707 s3).
--
-- Every change adds: one column, two functions. Nothing existing is changed or dropped.
-- Proven by supabase/checks/product_mcp.sql.
--
-- Rollback: `update public.products set mcp_enabled = false;` stops every server at once; then a
-- follow-up migration drops product_mcp_for_key(), product_mcp_set() and products.mcp_enabled, after the
-- galaxy route and card that read them are reverted.

-- ── The switch ───────────────────────────────────────────────────────────────────

alter table public.products add column mcp_enabled boolean not null default false;

comment on column public.products.mcp_enabled is
  'PRD 2707: whether the product''s MCP server (/api/products/<key>/mcp) answers the workspace''s API keys. Off by default; only an owner of the workspace switches it, through product_mcp_set().';

-- Turns the product's MCP server on or off, for an owner of its workspace. Answers the new state.
create function public.product_mcp_set(p_product uuid, p_on boolean) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
begin
  owned := public.product_live(public.product_owner_of(p_product, 'turns on or off the MCP server of'));
  if p_on is null then
    raise exception 'On: true or false.' using errcode = '22023', hint = 'on';
  end if;
  if owned.mcp_enabled is distinct from p_on then
    update public.products p set mcp_enabled = p_on where p.id = owned.id returning * into owned;
  end if;
  return owned.mcp_enabled;
end;
$$;

comment on function public.product_mcp_set(uuid, boolean) is
  'PRD 2707: an owner of the workspace turns the product''s MCP server on or off; answers the new state. 42501 not an owner, P0002 no such product or an archived one, 22023 no state.';

-- ── The route's check (service role only) ────────────────────────────────────────

-- A repository of the product as the route reads it: its newest pack in the workspace, or none yet.
create function public.product_mcp_repository(p_workspace uuid, p_repo text) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('repo', p_repo, 'pack_id', k.id, 'sha', k.sha, 'committed_at', k.committed_at)
    from (select 1) one
    left join public.knowledge_packs k on k.workspace_id = p_workspace and k.repository = p_repo and k.newest
$$;

comment on function public.product_mcp_repository(uuid, text) is
  'PRD 2707: {repo, pack_id, sha, committed_at} of the repository''s newest knowledge pack in the workspace, the pack fields null when none was kept yet. Internal to product_mcp_for_key().';

-- What the API key `p_hash` reads of the product `p_key` through its MCP server, or null (see the header).
create function public.product_mcp_for_key(p_hash text, p_key text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key  text := lower(btrim(coalesce(p_key, '')));
  k      jsonb;
  allow  text[];
  p      public.products;
  repos  text[];
  home   text;
begin
  if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
    return null;
  end if;
  k := public.api_key_of(p_hash);
  if k is null then
    return null;
  end if;
  select * into p from public.products x
   where x.workspace_id = (k->>'workspace_id')::uuid and x.key = v_key
     and x.archived_at is null and x.mcp_enabled;
  if not found then
    return null;
  end if;

  select coalesce(array_agg(r order by r), '{}') into allow from jsonb_array_elements_text(k->'repos') r;
  select coalesce(array_agg(l.repository order by l.repository collate "C"), '{}') into repos
    from public.product_repositories l
   where l.product_id = p.id and (cardinality(allow) = 0 or l.repository = any (allow));
  if cardinality(allow) > 0 and cardinality(repos) = 0 then
    return null;
  end if;

  home := public.product_law_home(p.id);
  return jsonb_build_object(
    'product', jsonb_build_object('id', p.id, 'key', p.key, 'name', p.name, 'workspace_id', p.workspace_id),
    'repositories', coalesce((select jsonb_agg(public.product_mcp_repository(p.workspace_id, r) order by o)
                                from unnest(repos) with ordinality as x (r, o)), '[]'::jsonb),
    'law_home', case when home is not null then public.product_mcp_repository(p.workspace_id, home) end,
    'knowledge', public.product_knowledge_for_agents(p.id));
end;
$$;

comment on function public.product_mcp_for_key(text, text) is
  'PRD 2707: what a live API key of the product''s workspace reads of it through its MCP server: {product, repositories, law_home, knowledge}, or null when the key does not work, the product is not the key''s workspace''s, archived or off, or the key''s allow-list names none of its repositories. The service role''s only.';

-- ── Who may call what ────────────────────────────────────────────────────────────

-- mcp_enabled is read through the table's select grant, and written only by product_mcp_set().
revoke execute on function public.product_mcp_set(uuid, boolean) from public, anon;
grant execute on function public.product_mcp_set(uuid, boolean) to authenticated;
revoke execute on function public.product_mcp_repository(uuid, text) from public, anon, authenticated, service_role;
-- The hash is the credential, checked by the route alone.
revoke execute on function public.product_mcp_for_key(text, text) from public, anon, authenticated;
grant execute on function public.product_mcp_for_key(text, text) to service_role;
