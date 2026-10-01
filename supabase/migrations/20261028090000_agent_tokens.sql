-- Agent tokens (PRD 855 s1, docs: .omni-loop/delivery/inbox/0855-agent-connect/spec.md). A member of a
-- workspace makes a named, read-only link for one of their editors' agents (Cursor, Claude Code, any MCP
-- client), sees it once, and revokes it; the workspace's owner revokes any. The link reads the
-- workspace's business through the very product read business_for_repo() answers (decision 8), with
-- the token checked by the database (decision 6): galaxy passes the token's SHA-256 hash, never a key.
--
--   public.agent_tokens                     one row per link: its name, maker, SHA-256 hash and last four
--                                           characters (decision 9); never the token itself. No policy
--                                           lets anyone read a row: the list goes through agent_tokens_list()
--   agent_token_make(workspace, name, hash, last_four)   any member, for themselves: 1 to 40 characters,
--                                           unique among their live links, 20 live links a person at most
--   agent_token_revoke(workspace, token)    the maker, or an owner of the workspace; a revoked link stays
--                                           stored (decision 11)
--   agent_tokens_list(workspace)            any member: the workspace's links not revoked, newest first
--   business_for_product(workspace, product) the one product read (decision 8), internal: what
--                                           business_for_repo() returned until now, for a product
--   business_for_repo(repo)                 unchanged in what it answers: now reads through the above
--   business_for_token(hash, repo)          what an agent's link reads, for anyone holding the token (anon
--                                           included): its workspace's business, for `repo`, or the only
--                                           product when `repo` is left out
--   agent_token_of(hash)                    internal: the live link a hash names, or 28000
--
-- A link works only while it is not revoked and its maker is still a member of its workspace (decision
-- 10); otherwise every call is 28000 with one line saying to make a new link. `last_used_at` is written
-- at most once a minute (decision 16). There is no expiry (decision 11).
--
-- Refusals: 42501 (not a member, not the maker or an owner, another workspace's repository), 22023 (a
-- bad value, its field in the hint), 54000 (the 21st live link), 28000 (a link that does not work).
-- Proven by supabase/checks/agent_tokens.sql.
-- Rollback: `update public.agent_tokens set revoked_at = now() where revoked_at is null;` stops every
-- link at once; a follow-up migration drops the table and the six functions and restores
-- business_for_repo() from 20261022090000_personas.sql.

-- ── The table ────────────────────────────────────────────────────────────────────

create table public.agent_tokens (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  made_by      uuid not null references auth.users on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  last_four    text not null check (last_four ~ '^[A-Za-z0-9_-]{4}$'),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users on delete set null
);

comment on table public.agent_tokens is
  'An agent''s read-only link to its workspace''s business (PRD 855). Only the SHA-256 hash of the token (`omb_` + 32 random bytes, base64url) and its last four characters are stored. Written only by agent_token_make() and agent_token_revoke(); read through agent_tokens_list() and business_for_token().';
comment on column public.agent_tokens.last_used_at is 'When an agent last read through the link, written at most once a minute.';
comment on column public.agent_tokens.revoked_at is 'When it was revoked; a revoked link is kept, so what it asked still names it.';

-- A name is unique among its maker's live links in a workspace.
create unique index agent_tokens_live_name on public.agent_tokens (workspace_id, made_by, lower(name)) where revoked_at is null;
create index agent_tokens_workspace on public.agent_tokens (workspace_id, created_at desc);
create index agent_tokens_made_by on public.agent_tokens (made_by) where revoked_at is null;

-- ── The links ────────────────────────────────────────────────────────────────────

-- A link as the list shows it: never its hash.
create function public.agent_token_listed(t public.agent_tokens) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'lastFour', t.last_four,
    'createdAt', t.created_at,
    'lastUsedAt', t.last_used_at,
    'maker', jsonb_build_object(
      'id', t.made_by,
      'login', (select lower(coalesce(nullif(p.github_login, ''), (
                  select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
                    from auth.identities i
                   where i.user_id = t.made_by and i.provider = 'github'
                   order by i.created_at limit 1)))
                  from (select 1) one
                  left join public.players p on p.workspace_id = t.workspace_id and p.user_id = t.made_by),
      'name', (select coalesce(nullif(btrim(p.display_name), ''),
                               nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                               nullif(btrim(u.raw_user_meta_data ->> 'name'), ''))
                 from auth.users u
                 left join public.players p on p.workspace_id = t.workspace_id and p.user_id = u.id
                where u.id = t.made_by)),
    'mine', t.made_by = auth.uid(),
    'canRevoke', t.made_by = auth.uid() or public.is_owner(t.workspace_id),
    'working', exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.made_by))
$$;

-- Makes a link for the caller in `p_workspace`. Galaxy's server draws the token and sends only its
-- SHA-256 hash (64 hex characters) and its last four characters; the token never reaches the database.
create function public.agent_token_make(p_workspace uuid, p_name text, p_hash text, p_last_four text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  live integer;
  made public.agent_tokens;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can make a link to its business.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 or v_name ~ '[\r\n\t]' then
    raise exception 'Name: 1 to 40 characters, on one line.' using errcode = '22023', hint = 'name';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash: the token''s SHA-256, 64 hexadecimal characters.' using errcode = '22023', hint = 'hash';
  end if;
  if p_last_four is null or p_last_four !~ '^[A-Za-z0-9_-]{4}$' then
    raise exception 'Last four: the token''s last four characters.' using errcode = '22023', hint = 'last_four';
  end if;

  -- One person's links are counted one call at a time.
  perform pg_advisory_xact_lock(hashtextextended('agent_tokens:' || auth.uid()::text, 0));
  if exists (select 1 from public.agent_tokens t
              where t.workspace_id = p_workspace and t.made_by = auth.uid() and t.revoked_at is null
                and lower(t.name) = lower(v_name)) then
    raise exception 'Name: you already have a link named %.', v_name using errcode = '22023', hint = 'name';
  end if;
  select count(*) into live from public.agent_tokens t where t.made_by = auth.uid() and t.revoked_at is null;
  if live >= 20 then
    raise exception 'You hold 20 links already: revoke one to make another.' using errcode = '54000', hint = 'limit';
  end if;

  insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four)
  values (p_workspace, auth.uid(), v_name, p_hash, p_last_four)
  returning * into made;
  return public.agent_token_listed(made);
end;
$$;

-- Revokes a link of `p_workspace`: its maker, or an owner of the workspace. Revoking a revoked link
-- changes nothing.
create function public.agent_token_revoke(p_workspace uuid, p_token uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can revoke its links.' using errcode = '42501';
  end if;
  select * into t from public.agent_tokens x where x.id = p_token and x.workspace_id = p_workspace for update;
  if not found then
    raise exception 'Link: this workspace holds no such link.' using errcode = 'P0002', hint = 'token';
  end if;
  if t.made_by <> auth.uid() and not public.is_owner(p_workspace) then
    raise exception 'Only the person who made a link, or the workspace''s owner, can revoke it.' using errcode = '42501';
  end if;
  if t.revoked_at is null then
    update public.agent_tokens x set revoked_at = now(), revoked_by = auth.uid() where x.id = t.id returning * into t;
  end if;
  return public.agent_token_listed(t);
end;
$$;

-- The workspace's links not revoked, newest first, for any member: a link whose maker left the
-- workspace is listed with `working` false, so an owner can revoke it.
create function public.agent_tokens_list(p_workspace uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can see its links.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(public.agent_token_listed(t) order by t.created_at desc, t.id)
                     from public.agent_tokens t
                    where t.workspace_id = p_workspace and t.revoked_at is null), '[]'::jsonb);
end;
$$;

-- The live link `p_hash` names: not revoked, its maker still a member of its workspace. Anything else
-- is 28000, one line saying what to do.
create function public.agent_token_of(p_hash text) returns public.agent_tokens
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
begin
  if p_hash is not null and p_hash ~ '^[0-9a-f]{64}$' then
    select * into t from public.agent_tokens x
     where x.token_hash = p_hash and x.revoked_at is null
       and exists (select 1 from public.workspace_members m where m.workspace_id = x.workspace_id and m.user_id = x.made_by);
  end if;
  if t.id is null then
    raise exception 'This link does not work: make a new one on Settings › Business.' using errcode = '28000';
  end if;
  return t;
end;
$$;

-- ── The one product read (decision 8) ────────────────────────────────────────────

-- What agents read of `p_product` of the workspace's business: `{state, business, product, claims,
-- personas}`, as business_for_repo() answered it since 20261022090000_personas.sql. Confirmed and
-- contradicted claims: the business's region, and the rest from the product (none of a product when
-- it is null). `product` is named only while the business has several. `state` is `none` with no
-- business or no claim. Internal: callers check who asks.
create function public.business_for_product(p_workspace uuid, p_product uuid) returns jsonb
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
    return jsonb_build_object('state', 'none', 'business', null, 'product', null, 'claims', '[]'::jsonb, 'personas', '[]'::jsonb);
  end if;
  select p.* into product from public.products p where p.id = p_product and p.business_id = biz.id;
  select count(*) into products_count from public.products p where p.business_id = biz.id;
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
    'personas', cast_of);
end;
$$;

-- As 20261022090000_personas.sql, through business_for_product(): the same body, for the product
-- `repo` points at.
create or replace function public.business_for_repo(p_repo text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  product uuid;
begin
  select r.product_id into product
    from public.repositories r
   where r.workspace_id = ws and r.full_name = lower(btrim(p_repo));
  return public.business_for_product(ws, product);
end;
$$;

-- What an agent's link reads (PRD 855): its workspace's business, exactly as business_for_repo() answers
-- it to a member for the same repository. With `p_repo`, the repository must be the workspace's (one of
-- its repositories, or owned by its GitHub org), else 42501. Without, the business's only product; with
-- several, 22023 naming the workspace's tracked repositories, so the agent can pass one. Anyone holding
-- the token may call it, signed in or not.
create function public.business_for_token(p_hash text, p_repo text default null) returns jsonb
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
  tracked text;
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
    select r.product_id into product from public.repositories r where r.workspace_id = t.workspace_id and r.full_name = v_repo;
    return public.business_for_product(t.workspace_id, product);
  end if;

  select count(*), min(p.id::text)::uuid into products_count, product
    from public.products p join public.businesses b on b.id = p.business_id
   where b.workspace_id = t.workspace_id;
  if products_count > 1 then
    select string_agg(r.full_name, ', ' order by r.full_name) into tracked
      from public.repositories r where r.workspace_id = t.workspace_id and r.tracked;
    raise exception 'Repository: this workspace sells several products, so name the repository you work in: %.',
      coalesce(tracked, 'none is tracked yet') using errcode = '22023', hint = 'repo';
  end if;
  return public.business_for_product(t.workspace_id, product);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.agent_tokens enable row level security;

-- No policy: nobody signed in reads or writes a row directly, and nobody reads a hash.
revoke all on public.agent_tokens from public, anon, authenticated, service_role;

revoke execute on function public.agent_token_listed(public.agent_tokens) from public, anon, authenticated;
revoke execute on function public.agent_token_of(text) from public, anon, authenticated;
revoke execute on function public.business_for_product(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.agent_token_make(uuid, text, text, text) from public, anon;
grant execute on function public.agent_token_make(uuid, text, text, text) to authenticated;
revoke execute on function public.agent_token_revoke(uuid, uuid) from public, anon;
grant execute on function public.agent_token_revoke(uuid, uuid) to authenticated;
revoke execute on function public.agent_tokens_list(uuid) from public, anon;
grant execute on function public.agent_tokens_list(uuid) to authenticated;

-- The token is the credential: galaxy's MCP route calls it as nobody.
revoke execute on function public.business_for_token(text, text) from public;
grant execute on function public.business_for_token(text, text) to anon, authenticated;
