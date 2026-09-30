-- The canon check's store (PRD 839, docs: .omni-loop/delivery/inbox/0839-canon-check/spec.md). The only
-- migration of the PRD: a product's Never lines, and the read the omni-loop App grades a spec against.
--
--   claims.kind gains `never`                 a line the team never crosses ("Build for groups of
--                                             companies"), which belongs to a product, 1 to 200 characters
--                                             on one line (every other kind keeps 1 to 80)
--   claim_pick(workspace, product, kind, value, source)   as 20261019090000_business_store.sql, taking
--                                             `never`: a typed Never line is a pick, `confirmed` at once
--   claim_propose_evidence(workspace, product, kind, value, receipts)   as
--                                             20261021090000_business_evidence.sql, taking `never`: the
--                                             draft and the recheck propose one with its receipts
--   claims_cite(repo, ids, by, ref)           as 20261019090000_business_store.sql, taking `never#<seq>`
--   business_for_repo_app(repo)               the App's read (decision 7), by repository, service role
--                                             only: the confirmed claims of the product of the workspace
--                                             that tracks `repo` (its region from the business), its
--                                             personas, and when either last changed
--
-- business_for_repo() is unchanged: it already returns every kind, so agents read `never#<seq>` lines.
-- claim_answer() keeps its five kinds: a Never line is typed or proposed, never answered in a skill run.
-- `create or replace` keeps each function's grants as its first migration set them.
--
-- Proven by supabase/checks/business.sql.
-- Rollback: delete every `never` claim, then a follow-up migration restores the two checks on claims,
-- claim_pick() and claims_cite() from 20261019090000_business_store.sql and claim_propose_evidence()
-- from 20261021090000_business_evidence.sql, and drops business_for_repo_app() and business_claim_value().

-- ── The kind ─────────────────────────────────────────────────────────────────────

alter table public.claims drop constraint claims_kind_check;
alter table public.claims add constraint claims_kind_check
  check (kind in ('region', 'offering', 'size', 'trade', 'rival', 'never'));
alter table public.claims drop constraint claims_value_check;
alter table public.claims add constraint claims_value_check
  check (char_length(value) between 1 and case when kind = 'never' then 200 else 80 end);

comment on table public.claims is
  'A business fact (PRD 748). Display id `<kind>#<seq>`, seq counted over the whole business. States: proposed | confirmed | rejected | contradicted | unknown; a rejected claim is kept, so it is never proposed again. Kind `never` (PRD 839) is a product''s Never line, up to 200 characters. Only confirmed claims leave the app (business_for_repo(), business_for_repo_app()).';

-- A claim's value as a person gave it: trimmed, on one line, 1 to 200 characters for a Never line and
-- 1 to 80 for every other kind, or 22023 naming `value`.
create function public.business_claim_value(p_value text, p_kind text) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if p_kind is distinct from 'never' then
    return public.business_text(p_value, 'value', 'Value');
  end if;
  if char_length(v) not between 1 and 200 or v ~ '[\r\n\t]' then
    raise exception 'Value: a Never line is 1 to 200 characters, on one line.' using errcode = '22023', hint = 'value';
  end if;
  return v;
end;
$$;

-- ── The writes that take it ──────────────────────────────────────────────────────

-- As 20261019090000_business_store.sql, taking `never`: a Never line belongs to a product and is a
-- pick, confirmed at once; only a rival is suggested.
create or replace function public.claim_pick(p_workspace uuid, p_product uuid, p_kind text, p_value text, p_source text default 'pick')
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
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival', 'never') then
    raise exception 'Kind: region, offering, size, trade, rival or never.' using errcode = '22023', hint = 'kind';
  end if;
  if p_source is null or p_source not in ('pick', 'suggestion') then
    raise exception 'Source: pick or suggestion.' using errcode = '22023', hint = 'source';
  end if;
  if p_source = 'suggestion' and p_kind <> 'rival' then
    raise exception 'Source: only a rival is suggested.' using errcode = '22023', hint = 'source';
  end if;
  v := public.business_claim_value(p_value, p_kind);
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

-- As 20261021090000_business_evidence.sql, taking `never`: a source saying what the product does not
-- do proposes a Never line with its receipts. A Never line replaces nothing: several are held at once.
create or replace function public.claim_propose_evidence(p_workspace uuid, p_product uuid, p_kind text, p_value text, p_receipts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz public.businesses;
  v text;
  r jsonb;
  product uuid := p_product;
  there public.claims;
  held public.claims;
  seq_next integer;
  made public.claims;
begin
  perform public.business_runner_only(p_workspace);
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival', 'never') then
    raise exception 'Kind: region, offering, size, trade, rival or never.' using errcode = '22023', hint = 'kind';
  end if;
  v := public.business_claim_value(p_value, p_kind);
  if p_kind = 'size' then
    perform public.business_size_check(v);
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts) <> 'array' or jsonb_array_length(p_receipts) not between 1 and 20 then
    raise exception 'Receipts: 1 to 20, each {kind, where, quote}.' using errcode = '22023', hint = 'receipts';
  end if;
  for r in select * from jsonb_array_elements(p_receipts) loop
    if jsonb_typeof(r) <> 'object' or coalesce(r->>'kind', '') not in ('file', 'pr', 'link')
       or char_length(btrim(coalesce(r->>'where', ''))) not between 1 and 500
       or char_length(coalesce(r->>'quote', '')) not between 1 and 300 then
      raise exception 'Receipts: each {kind: file, pr or link, where: 1 to 500 characters, quote: 1 to 300 characters}.'
        using errcode = '22023', hint = 'receipts';
    end if;
  end loop;

  select * into biz from public.businesses b where b.workspace_id = p_workspace for update;
  if not found then
    raise exception 'Business: this workspace has none yet.' using errcode = 'P0002', hint = 'business';
  end if;
  if p_kind = 'region' then
    product := null;
  else
    if p_product is null then
      raise exception 'Product: a % belongs to a product.', p_kind using errcode = '22023', hint = 'product';
    end if;
    perform public.business_product(p_workspace, p_product);
  end if;

  select * into there from public.claims c
   where c.business_id = biz.id and c.product_id is not distinct from product and c.kind = p_kind and lower(c.value) = lower(v);
  if found then
    if there.state = 'rejected' then
      return jsonb_build_object('outcome', 'rejected', 'id', null);
    end if;
    perform public.claim_receipts_add(there, p_receipts);
    return jsonb_build_object('outcome', 'seen', 'id', there.kind || '#' || there.seq);
  end if;

  -- An offering or a size holds one value: another one held is what the new one would replace.
  if p_kind in ('offering', 'size') then
    select * into held from public.claims c
     where c.business_id = biz.id and c.product_id is not distinct from product and c.kind = p_kind
       and c.state in ('confirmed', 'contradicted')
     order by c.seq limit 1;
  end if;

  select coalesce(max(c.seq), 0) + 1 into seq_next from public.claims c where c.business_id = biz.id;
  insert into public.claims (workspace_id, business_id, product_id, seq, kind, value, source, state, replaces, created_by)
  values (p_workspace, biz.id, product, seq_next, p_kind, v, 'evidence', 'proposed', held.id, auth.uid())
  returning * into made;
  perform public.claim_receipts_add(made, p_receipts);
  if held.id is not null then
    update public.claims c set state = 'contradicted', updated_at = now() where c.id = held.id;
    return jsonb_build_object('outcome', 'replacing', 'id', made.kind || '#' || made.seq);
  end if;
  return jsonb_build_object('outcome', 'added', 'id', made.kind || '#' || made.seq);
end;
$$;

-- As 20261019090000_business_store.sql, taking `never#<seq>`: agents cite a Never line like any claim.
create or replace function public.claims_cite(p_repo text, p_ids text[], p_by text, p_ref text default null) returns integer
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
    if one is null or one !~ '^(region|offering|size|trade|rival|never)#[1-9][0-9]{0,8}$' then
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

-- ── What the App reads ───────────────────────────────────────────────────────────

-- The business the omni-loop App grades a phase-0 spec against (decision 7), read with the service
-- role by repository, since the App signs in as nobody: `{state, business, product, claims, personas,
-- updatedAt}`. The workspace is the one that tracks `repo` (the one whose GitHub org owns it first,
-- then the oldest to track it). Confirmed claims only, contradicted ones included neither: the
-- business's region, and the rest from the repository's product (the region only when it points at
-- none). Personas: that product's, not deleted, oldest first. `updatedAt`: when a claim or persona of
-- the product (or the region) last changed, in any state, so a verdict cached by it is stale the moment
-- one changes; null with nothing. `state` is `none` when no workspace tracks `repo`, it has no business
-- or no confirmed claim for this repository; the first two answer nothing else, the third still its
-- name and personas. A malformed `repo` is 22023.
create function public.business_for_repo_app(p_repo text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  ws uuid;
  biz public.businesses;
  product public.products;
  products_count integer;
  listed jsonb;
  cast_of jsonb;
  changed timestamptz;
  nothing constant jsonb := jsonb_build_object('state', 'none', 'business', null, 'product', null,
                                               'claims', '[]'::jsonb, 'personas', '[]'::jsonb, 'updatedAt', null);
begin
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  select r.workspace_id into ws
    from public.repositories r join public.workspaces w on w.id = r.workspace_id
   where r.full_name = v_repo and r.tracked
   order by (lower(w.github_org) is not distinct from split_part(v_repo, '/', 1)) desc, r.added_at, w.slug
   limit 1;
  if ws is null then
    return nothing;
  end if;
  select * into biz from public.businesses b where b.workspace_id = ws;
  if not found then
    return nothing;
  end if;
  select p.* into product
    from public.repositories r join public.products p on p.id = r.product_id
   where r.workspace_id = ws and r.full_name = v_repo;
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
   where c.business_id = biz.id and c.state = 'confirmed'
     and (c.product_id is null or c.product_id = product.id);
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.name, 'stance', p.stance, 'trade', p.trade, 'who', p.who, 'usage', p.usage) order by p.ordinal), '[]'::jsonb)
    into cast_of
    from public.personas p
   where p.product_id = product.id and p.deleted_at is null;
  select max(t) into changed from (
    select c.updated_at as t from public.claims c
     where c.business_id = biz.id and (c.product_id is null or c.product_id = product.id)
    union all
    select greatest(p.updated_at, p.deleted_at) from public.personas p where p.product_id = product.id
  ) changes;
  return jsonb_build_object(
    'state', case when jsonb_array_length(listed) = 0 then 'none' else 'ok' end,
    'business', jsonb_build_object('name', biz.name),
    'product', case when products_count > 1 and product.id is not null then jsonb_build_object('name', product.name) end,
    'claims', listed,
    'personas', cast_of,
    'updatedAt', changed);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

revoke execute on function public.business_claim_value(text, text) from public, anon, authenticated;
revoke execute on function public.business_for_repo_app(text) from public, anon, authenticated;
grant execute on function public.business_for_repo_app(text) to service_role;
