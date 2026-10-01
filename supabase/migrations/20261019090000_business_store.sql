-- The business store (PRD 748, docs: .omni-loop/delivery/inbox/0748-business-store/spec.md). A
-- workspace has at most one business, which holds one or more products; every repository of the
-- workspace points at one product. Each business fact is a claim: `region` belongs to the business,
-- `offering`, `size`, `trade` and `rival` to a product. Each claim carries a sequence number counted
-- over every claim of the business, whatever its kind, which gives it its display id `<kind>#<seq>`.
-- Agents cite claims, and each citation is appended to claim_citations, which nothing rewrites.
--
-- Every member of the workspace reads it (row-level security by is_member()). Nobody writes the
-- tables directly: every write goes through a security-definer function run as the signed-in person,
-- built like 20261008090000_repositories.sql, refusing with 42501 (not a member), P0002 (gone) or
-- 22023 (invalid, the field in `hint`). Any member writes: the store is not owner-only.
--
--   business_open(workspace)                       creates the business and its first product, once
--   claim_pick(workspace, product, kind, value, source)   a person's pick (confirmed) or a suggestion (proposed)
--   claim_set_state(workspace, claim, state)       ✓ confirms, ✗ rejects; the row is kept
--   product_add(workspace, name) · product_rename(workspace, product, name)
--   repository_set_product(workspace, repository, product)
--   claims_cite(repo, ids, by, ref)                the kit's citation log, by display id
--   business_for_repo(repo)                        the kit's read: confirmed claims only
--
-- Nothing is seeded: an empty workspace has no business until someone opens its page.
--
-- Proven by supabase/checks/business.sql.
-- Rollback: a follow-up migration drops claim_citations, claims, products, businesses,
-- repositories.product_id, the trigger on repositories and the functions below; nothing else reads them.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.businesses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.businesses is
  'A workspace''s business (PRD 748), at most one. Made by business_open() the first time its page is opened, named after the workspace.';

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  business_id  uuid not null references public.businesses on delete cascade,
  ordinal      bigint generated always as identity,
  name         text not null check (char_length(name) between 1 and 80),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now()
);

create unique index products_name_idx on public.products (business_id, lower(name));
create index products_business_idx on public.products (business_id, ordinal);

comment on table public.products is
  'What a business sells (PRD 748): one or more per business. The first is made with the business; product_add() adds more. The first product is the one the page shows while there is only one.';

create table public.claims (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  business_id  uuid not null references public.businesses on delete cascade,
  product_id   uuid references public.products on delete cascade,
  seq          integer not null check (seq > 0),
  kind         text not null check (kind in ('region', 'offering', 'size', 'trade', 'rival')),
  value        text not null check (char_length(value) between 1 and 80),
  source       text not null check (source in ('pick', 'suggestion', 'evidence', 'answer')),
  state        text not null check (state in ('proposed', 'confirmed', 'rejected', 'contradicted', 'unknown')),
  receipt      text check (receipt is null or char_length(receipt) between 1 and 2000),
  last_seen    timestamptz,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, seq),
  -- A region belongs to the business; every other kind to one of its products.
  check ((kind = 'region') = (product_id is null))
);

-- One claim per value of a kind, per product (or per business, for a region): a pick of a value
-- already there confirms it, and a suggestion of one already there, even rejected, adds nothing.
create unique index claims_value_idx on public.claims (business_id, product_id, kind, lower(value)) nulls not distinct;
create index claims_product_idx on public.claims (product_id);

comment on table public.claims is
  'A business fact (PRD 748). Display id `<kind>#<seq>`, seq counted over the whole business. States: proposed | confirmed | rejected | contradicted | unknown; a rejected claim is kept, so it is never proposed again. Only confirmed claims leave the app (business_for_repo()).';
comment on column public.claims.receipt is 'Where the claim was seen, when there is a source to show. Null for a pick or a suggestion.';
comment on column public.claims.last_seen is 'When evidence last showed the claim (a later area). Null until then.';

create table public.claim_citations (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  claim_id     uuid not null references public.claims on delete cascade,
  cited_by     text not null check (char_length(cited_by) between 1 and 80),
  ref          text check (ref is null or char_length(ref) between 1 and 200),
  cited_as     uuid references auth.users on delete set null,
  cited_at     timestamptz not null default now()
);

create index claim_citations_claim_idx on public.claim_citations (claim_id, cited_at);

comment on table public.claim_citations is
  'The citation log (PRD 748): one row each time an agent cited a claim, appended by claims_cite(). Nobody updates or deletes a row. cited_by: the skill (think-big); ref: the run (concept #9); cited_as: the account whose terminal cited it.';

alter table public.repositories add column product_id uuid references public.products on delete set null;

comment on column public.repositories.product_id is
  'The product this repository serves (PRD 748): its agents read that product''s claims. Null: the business''s claims only.';

-- ── Who may write ────────────────────────────────────────────────────────────────

-- Refuses the caller unless they are a member of the workspace.
create function public.business_member_only(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can change its business.' using errcode = '42501';
  end if;
end;
$$;

-- The workspace's business, or P0002 when nobody opened it yet.
create function public.business_of(p_workspace uuid) returns public.businesses
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one public.businesses;
begin
  select * into found_one from public.businesses b where b.workspace_id = p_workspace;
  if not found then
    raise exception 'Business: this workspace has none yet.' using errcode = 'P0002', hint = 'business';
  end if;
  return found_one;
end;
$$;

-- The workspace's first product: the one a repository points at by default.
create function public.business_first_product(p_workspace uuid) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select p.id from public.products p where p.workspace_id = p_workspace order by p.ordinal limit 1
$$;

-- A product of the workspace, or P0002.
create function public.business_product(p_workspace uuid, p_product uuid) returns public.products
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
  return found_one;
end;
$$;

-- A name as a person gave it: trimmed, 1 to 80 characters on one line, or 22023 naming `field`.
create function public.business_text(p_value text, p_field text, p_label text) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if char_length(v) not between 1 and 80 or v ~ '[\r\n\t]' then
    raise exception '%: 1 to 80 characters, on one line.', p_label using errcode = '22023', hint = p_field;
  end if;
  return v;
end;
$$;

-- The size slider's stops, in order (decision 10).
create function public.business_size_stop(p_stop text) returns integer
language sql immutable
set search_path = ''
as $$
  select array_position(array['1', '2', '5', '10', '20', '50', '100', '250', '500', '1000+'], p_stop)
$$;

-- Opens the workspace's business: made the first time, with its first product, both named after the
-- workspace, and every repository of the workspace pointed at that product. Opened again, it answers
-- the business as it is.
create function public.business_open(p_workspace uuid) returns public.businesses
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
  update public.repositories r set product_id = first_product where r.workspace_id = p_workspace and r.product_id is null;
  return made;
end;
$$;

-- A person's pick (source `pick`, confirmed at once) or a suggested rival (source `suggestion`,
-- proposed until someone confirms it). A region takes no product; every other kind names one of the
-- business's products. A size is `<min>-<max>` of the slider's stops. The value already there: a pick
-- confirms it, a suggestion leaves it as it is (a rejected rival is never proposed again).
create function public.claim_pick(p_workspace uuid, p_product uuid, p_kind text, p_value text, p_source text default 'pick')
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz public.businesses;
  v text;
  lo text;
  hi text;
  seq_next integer;
  made public.claims;
  product uuid := p_product;
begin
  perform public.business_member_only(p_workspace);
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival') then
    raise exception 'Kind: region, offering, size, trade or rival.' using errcode = '22023', hint = 'kind';
  end if;
  if p_source is null or p_source not in ('pick', 'suggestion') then
    raise exception 'Source: pick or suggestion.' using errcode = '22023', hint = 'source';
  end if;
  if p_source = 'suggestion' and p_kind <> 'rival' then
    raise exception 'Source: only a rival is suggested.' using errcode = '22023', hint = 'source';
  end if;
  v := public.business_text(p_value, 'value', 'Value');
  if p_kind = 'size' then
    lo := split_part(v, '-', 1);
    hi := substr(v, char_length(lo) + 2);
    if v !~ '^[0-9]+\+?-[0-9]+\+?$' or public.business_size_stop(lo) is null or public.business_size_stop(hi) is null
       or public.business_size_stop(lo) > public.business_size_stop(hi) then
      raise exception 'Size: <min>-<max>, each one of 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000+.' using errcode = '22023', hint = 'value';
    end if;
  end if;

  -- The business's row is locked, so two picks never take one number.
  select * into biz from public.businesses b where b.workspace_id = p_workspace for update;
  if not found then
    raise exception 'Business: this workspace has none yet.' using errcode = 'P0002', hint = 'business';
  end if;
  if p_kind = 'region' then
    product := null;
  else
    if p_product is null then
      raise exception 'Product: a % belongs to a product.' , p_kind using errcode = '22023', hint = 'product';
    end if;
    perform public.business_product(p_workspace, p_product);
  end if;

  select * into made from public.claims c
   where c.business_id = biz.id and c.product_id is not distinct from product and c.kind = p_kind and lower(c.value) = lower(v);
  if found then
    if p_source = 'pick' and made.state <> 'confirmed' then
      update public.claims c set state = 'confirmed', updated_at = now() where c.id = made.id returning * into made;
    end if;
    return made;
  end if;

  select coalesce(max(c.seq), 0) + 1 into seq_next from public.claims c where c.business_id = biz.id;
  insert into public.claims (workspace_id, business_id, product_id, seq, kind, value, source, state, created_by)
  values (p_workspace, biz.id, product, seq_next, p_kind, v, p_source,
          case when p_source = 'pick' then 'confirmed' else 'proposed' end, auth.uid())
  returning * into made;
  return made;
end;
$$;

-- ✓ Right confirms a claim, ✗ Wrong rejects it; the row is kept either way. The other states belong
-- to later areas.
create function public.claim_set_state(p_workspace uuid, p_claim uuid, p_state text) returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.claims;
begin
  perform public.business_member_only(p_workspace);
  if p_state is null or p_state not in ('confirmed', 'rejected') then
    raise exception 'State: confirmed or rejected.' using errcode = '22023', hint = 'state';
  end if;
  update public.claims c set state = p_state, updated_at = now()
   where c.id = p_claim and c.workspace_id = p_workspace
  returning * into changed;
  if not found then
    raise exception 'Claim: no such claim in this workspace.' using errcode = 'P0002', hint = 'claim';
  end if;
  return changed;
end;
$$;

-- Adds a product to the business, by name.
create function public.product_add(p_workspace uuid, p_name text) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz public.businesses;
  v text;
  made public.products;
begin
  perform public.business_member_only(p_workspace);
  v := public.business_text(p_name, 'name', 'Name');
  biz := public.business_of(p_workspace);
  if exists (select 1 from public.products p where p.business_id = biz.id and lower(p.name) = lower(v)) then
    raise exception 'Name: another product is called %.', v using errcode = '22023', hint = 'name';
  end if;
  insert into public.products (workspace_id, business_id, name, created_by)
  values (p_workspace, biz.id, v, auth.uid())
  returning * into made;
  return made;
end;
$$;

-- Renames a product of the business.
create function public.product_rename(p_workspace uuid, p_product uuid, p_name text) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text;
  changed public.products;
begin
  perform public.business_member_only(p_workspace);
  v := public.business_text(p_name, 'name', 'Name');
  perform public.business_product(p_workspace, p_product);
  if exists (select 1 from public.products p where p.workspace_id = p_workspace and p.id <> p_product and lower(p.name) = lower(v)) then
    raise exception 'Name: another product is called %.', v using errcode = '22023', hint = 'name';
  end if;
  update public.products p set name = v where p.id = p_product returning * into changed;
  return changed;
end;
$$;

-- Points a repository of the workspace at one of its products.
create function public.repository_set_product(p_workspace uuid, p_full_name text, p_product uuid) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.repositories;
begin
  perform public.business_member_only(p_workspace);
  perform public.business_product(p_workspace, p_product);
  update public.repositories r set product_id = p_product
   where r.workspace_id = p_workspace and r.full_name = lower(btrim(coalesce(p_full_name, '')))
  returning * into changed;
  if not found then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  return changed;
end;
$$;

-- A repository tracked after the business was opened points at its first product too (decision 12).
create function public.repositories_default_product() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_id is null then
    new.product_id := public.business_first_product(new.workspace_id);
  end if;
  return new;
end;
$$;

create trigger repositories_default_product before insert on public.repositories
  for each row execute function public.repositories_default_product();

-- ── What the kit calls ───────────────────────────────────────────────────────────

-- The workspace a call of the signed-in person for `repo` goes to (repo_workspace()), or 42501 with
-- its reason.
create function public.business_workspace(p_repo text) returns uuid
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  pick record;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if lower(btrim(coalesce(p_repo, ''))) !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  select * into pick from public.repo_workspace(auth.uid(), lower(btrim(p_repo)));
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;
  return pick.workspace_id;
end;
$$;

-- What agents in `repo` read (decision 14): `{state, business, product, claims}`. Confirmed claims
-- only: the business's region, and the rest from the repository's product; a repository with no
-- product reads the business's claims only. `product` is null while the business has one product.
-- `state` is `none` when there is no business or no confirmed claim for this repository.
create function public.business_for_repo(p_repo text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  biz public.businesses;
  product public.products;
  products_count integer;
  listed jsonb;
begin
  select * into biz from public.businesses b where b.workspace_id = ws;
  if not found then
    return jsonb_build_object('state', 'none', 'business', null, 'product', null, 'claims', '[]'::jsonb);
  end if;
  select p.* into product
    from public.repositories r join public.products p on p.id = r.product_id
   where r.workspace_id = ws and r.full_name = lower(btrim(p_repo));
  select count(*) into products_count from public.products p where p.business_id = biz.id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.kind || '#' || c.seq, 'kind', c.kind, 'value', c.value, 'source', c.source,
           'receipt', c.receipt, 'lastSeen', c.last_seen) order by c.seq), '[]'::jsonb)
    into listed
    from public.claims c
   where c.business_id = biz.id and c.state = 'confirmed'
     and (c.product_id is null or c.product_id = product.id);
  return jsonb_build_object(
    'state', case when jsonb_array_length(listed) = 0 then 'none' else 'ok' end,
    'business', jsonb_build_object('name', biz.name),
    'product', case when products_count > 1 and product.id is not null then jsonb_build_object('name', product.name) end,
    'claims', listed);
end;
$$;

-- Appends one citation per display id (`rival#4`) of the business `repo`'s workspace holds, cited by
-- `by` (a skill) for `ref` (the run). Answers how many were appended. An id that is not
-- `<kind>#<seq>` is 22023; one the business does not hold is P0002, and nothing is appended.
create function public.claims_cite(p_repo text, p_ids text[], p_by text, p_ref text default null) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  v_by text := public.business_text(p_by, 'by', 'By');
  v_ref text := nullif(btrim(coalesce(p_ref, '')), '');
  one text;
  claim uuid;
  wanted uuid[] := '{}';
begin
  if p_ids is null or cardinality(p_ids) not between 1 and 100 then
    raise exception 'Ids: 1 to 100 claim ids.' using errcode = '22023', hint = 'ids';
  end if;
  if v_ref is not null and (char_length(v_ref) > 200 or v_ref ~ '[\r\n]') then
    raise exception 'Ref: up to 200 characters, on one line.' using errcode = '22023', hint = 'ref';
  end if;
  foreach one in array p_ids loop
    if one is null or one !~ '^(region|offering|size|trade|rival)#[1-9][0-9]{0,8}$' then
      raise exception 'Ids: % is not a claim id like rival#4.', coalesce(one, 'null') using errcode = '22023', hint = 'ids';
    end if;
    select c.id into claim from public.claims c
     where c.workspace_id = ws and c.kind = split_part(one, '#', 1) and c.seq = split_part(one, '#', 2)::integer;
    if not found then
      raise exception 'Ids: this business holds no %.', one using errcode = 'P0002', hint = 'ids';
    end if;
    wanted := wanted || claim;
  end loop;
  insert into public.claim_citations (workspace_id, claim_id, cited_by, ref, cited_as)
  select ws, w, v_by, v_ref, auth.uid() from unnest(wanted) w;
  return cardinality(wanted);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.claims enable row level security;
alter table public.claim_citations enable row level security;

create policy "a member reads their workspace's business" on public.businesses
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's products" on public.products
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's claims" on public.claims
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's citations" on public.claim_citations
  for select to authenticated using (public.is_member(workspace_id));

-- Signed out: nothing. Signed in: reads only, the rows above. Nobody, the service role included,
-- writes these tables directly, and nobody updates or deletes a citation.
revoke all on public.businesses, public.products, public.claims, public.claim_citations
  from public, anon, authenticated, service_role;
grant select on public.businesses, public.products, public.claims, public.claim_citations to authenticated, service_role;

revoke execute on function public.business_member_only(uuid) from public, anon, authenticated;
revoke execute on function public.business_of(uuid) from public, anon, authenticated;
revoke execute on function public.business_first_product(uuid) from public, anon, authenticated;
revoke execute on function public.business_product(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.business_text(text, text, text) from public, anon, authenticated;
revoke execute on function public.business_size_stop(text) from public, anon, authenticated;
revoke execute on function public.business_workspace(text) from public, anon, authenticated;
revoke execute on function public.repositories_default_product() from public, anon, authenticated;

revoke execute on function public.business_open(uuid) from public, anon;
grant execute on function public.business_open(uuid) to authenticated;
revoke execute on function public.claim_pick(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.claim_pick(uuid, uuid, text, text, text) to authenticated;
revoke execute on function public.claim_set_state(uuid, uuid, text) from public, anon;
grant execute on function public.claim_set_state(uuid, uuid, text) to authenticated;
revoke execute on function public.product_add(uuid, text) from public, anon;
grant execute on function public.product_add(uuid, text) to authenticated;
revoke execute on function public.product_rename(uuid, uuid, text) from public, anon;
grant execute on function public.product_rename(uuid, uuid, text) to authenticated;
revoke execute on function public.repository_set_product(uuid, text, uuid) from public, anon;
grant execute on function public.repository_set_product(uuid, text, uuid) to authenticated;
revoke execute on function public.business_for_repo(text) from public, anon;
grant execute on function public.business_for_repo(text) to authenticated;
revoke execute on function public.claims_cite(text, text[], text, text) from public, anon;
grant execute on function public.claims_cite(text, text[], text, text) to authenticated;
