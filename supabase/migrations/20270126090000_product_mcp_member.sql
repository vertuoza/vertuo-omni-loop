-- A product's MCP server serves a member's kit sign-in as it serves an API key (PRD 3007 s1, docs:
-- .omni-loop/delivery/inbox/3007-kit-knowledge-mcp/spec.md).
--
-- /api/products/<key>/mcp takes, besides a workspace API key, the access token of the kit's sign-in (the one
-- `omni signin` keeps, or `OMNI_TOKEN` is traded for). The route has the Auth server check the token, then asks
-- this database what that person reads, on the service role's client, as it asks product_mcp_for_key() for a key.
--
--   product_mcp_for_member(user, key)   service role only, as product_mcp_for_key() is. Answers `{product,
--                                       user_id, repositories, law_home, knowledge}`: exactly what
--                                       product_mcp_for_key() answers a live key of the product's workspace
--                                       with no allow-list, with the person's id in place of the key's. Null
--                                       when the person is not a member of the product's workspace now, or
--                                       the product is off, archived, unknown or its key malformed
--   public.mcp_search_log.user_id       the signed-in person a row was served to, or null; a row served to a
--                                       key holds the key's id and no person, as before, and a row never
--                                       names both. A deleted account's id is set to null (L-GDPR-3)
--
-- product_mcp_for_member() answers only while all of these hold, and null for anything else:
-- - the person is a member of the product's workspace now (BR-PRODUCT-63, BR-PRODUCT-64, BL-ACCESS-1).
--   Nothing is kept between calls, so the moment they leave, the next call reads nothing;
-- - the product is on and not archived.
-- A person reaches the products of every workspace they are in. When two of them carry the key, the oldest
-- that is on answers (created first, then by id), as product_of_key() picks among a person's products.
-- `repositories` are all of the product's repositories, in name order, each with its newest knowledge pack;
-- `law_home` and `knowledge` are read exactly as product_mcp_for_key() reads them.
--
-- Every change adds: one column, one constraint, one index, one function. Nothing existing is changed or
-- dropped. Proven by supabase/checks/product_mcp.sql.
--
-- Rollback: revert the pull request (the route stops serving sign-ins, and nothing calls the function); then a
-- follow-up migration drops product_mcp_for_member(), the index mcp_search_log_user_asked_idx, the constraint
-- mcp_search_log_one_caller_check and the column public.mcp_search_log.user_id.

-- ── The person in the search log ─────────────────────────────────────────────────

alter table public.mcp_search_log
  add column user_id uuid references auth.users (id) on delete set null,
  add constraint mcp_search_log_one_caller_check check (api_key_id is null or user_id is null);

comment on column public.mcp_search_log.user_id is
  'PRD 3007: the signed-in member a call served through the kit''s sign-in was answered to, never their token; null for a call served to an API key (api_key_id) and once the account is deleted. A row never names both.';

-- The opened rank looks up a person's latest searches of a product, as it does a key's.
create index mcp_search_log_user_asked_idx on public.mcp_search_log (user_id, product_id, asked_at desc)
  where user_id is not null;

-- ── The route's check of a sign-in (service role only) ───────────────────────────

-- What the member `p_user`, whose access token the Auth server accepted, reads of the product `p_key`, or null.
create function public.product_mcp_for_member(p_user uuid, p_key text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key  text := lower(btrim(coalesce(p_key, '')));
  p      public.products;
  repos  text[];
  home   text;
begin
  if p_user is null or v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
    return null;
  end if;
  select x.* into p from public.products x
   where x.key = v_key and x.archived_at is null and x.mcp_enabled
     and exists (select 1 from public.workspace_members m where m.workspace_id = x.workspace_id and m.user_id = p_user)
   order by x.created_at, x.id
   limit 1;
  if not found then
    return null;
  end if;

  select coalesce(array_agg(l.repository order by l.repository collate "C"), '{}') into repos
    from public.product_repositories l
   where l.product_id = p.id;

  home := public.product_law_home(p.id);
  return jsonb_build_object(
    'product', jsonb_build_object('id', p.id, 'key', p.key, 'name', p.name, 'workspace_id', p.workspace_id),
    'user_id', p_user,
    'repositories', coalesce((select jsonb_agg(public.product_mcp_repository(p.workspace_id, r) order by o)
                                from unnest(repos) with ordinality as x (r, o)), '[]'::jsonb),
    'law_home', case when home is not null then public.product_mcp_repository(p.workspace_id, home) end,
    'knowledge', public.product_knowledge_for_agents(p.id));
end;
$$;

comment on function public.product_mcp_for_member(uuid, text) is
  'PRD 3007: what a member of the product''s workspace, signed in through the kit, reads of it through its MCP server: {product, user_id, repositories, law_home, knowledge}, as product_mcp_for_key() answers a key with no allow-list; null when the person is not a member now, or the product is off, archived or unknown. Of two products of the key, the oldest that is on. The service role''s only.';

-- ── Who may call what ────────────────────────────────────────────────────────────

-- The person's id is the route's to give, once the Auth server accepted their token: nobody else may name one.
-- The column is read through mcp_search_log's existing policy and written through its existing insert grant.
revoke execute on function public.product_mcp_for_member(uuid, text) from public, anon, authenticated;
grant execute on function public.product_mcp_for_member(uuid, text) to service_role;
