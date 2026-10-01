-- A product's constituents (PRD 871, docs: .omni-loop/delivery/inbox/0871-product-constituents/spec.md).
-- The only migration of the PRD: one Statement per product (what it is) and its Never list (what it must
-- never become or do), above every priority and the playbook, with an append-only log of every change.
--
--   constituents                              one row per Statement and per Never line of a product. A
--                                             Never line's id `never#<seq>` is counted per product over
--                                             every line it ever had, so a removed id is never reused. A
--                                             removal marks the row removed; no row is ever deleted
--   constituent_events                        the log: who, what (added, edited, removed, moved), when,
--                                             the text before and after. Appended in the same transaction
--                                             as the write it records; nobody updates or deletes one
--   constituent_add(workspace, product, kind, text)   an owner adds the Statement or a Never line
--   constituent_edit(workspace, constituent, text)    an owner rewrites one
--   constituent_remove(workspace, constituent)        an owner removes one: kept, marked removed
--   constituents_for_repo(repo)               the terminal's read (GET /api/constituents), as the caller
--   constituents_for_repo_app(repo)           the App's read, by repository, service role only
--   constituents_move_never_claims()          the one-time move below; run once here, by nobody else
--   claim_pick(…), claim_propose_evidence(…)  as 20261027090000_never_lines.sql, refusing kind `never`
--   jev_decision_names()                      as 20261026090000_jev_decisions.sql, with constituent-break
--
-- Only a workspace's owner writes (is_owner(), 20261003090000_own_fleets.sql); every member reads both
-- tables and the terminal's read. Refusals as the business store's: 42501 not an owner (or not a member,
-- for the read), P0002 gone, 22023 invalid with the field in `hint`.
--
-- The move: every product's confirmed `never` claims become its Never list, in their order, each logged
-- `moved` with "moved from Business" and the claim's id, and each claim is kept as `rejected`, so a
-- revert can set it back to `confirmed`. Nothing is seeded: a workspace with no Never line gets nothing.
--
-- Proven by supabase/checks/constituents.sql (and the claim kinds by supabase/checks/business.sql).
-- Rollback: a follow-up migration sets the moved claims (constituent_events.claim_id) back to
-- `confirmed`, restores claim_pick() and claim_propose_evidence() from 20261027090000_never_lines.sql
-- and jev_decision_names() from 20261026090000_jev_decisions.sql, and drops the two tables and the
-- functions below; nothing else reads them.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.constituents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  kind         text not null check (kind in ('statement', 'never')),
  -- A Never line's number, counted per product over every line it ever had; null for a Statement.
  seq          integer check (seq > 0),
  body         text not null check (char_length(body) between 1 and case when kind = 'statement' then 400 else 200 end),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  removed_at   timestamptz,
  removed_by   uuid references auth.users on delete set null,
  check ((kind = 'never') = (seq is not null))
);

create unique index constituents_never_seq_idx on public.constituents (product_id, seq) where kind = 'never';
-- One live Statement per product; a removed one stays beside the next.
create unique index constituents_statement_idx on public.constituents (product_id) where kind = 'statement' and removed_at is null;
create index constituents_workspace_idx on public.constituents (workspace_id);

comment on table public.constituents is
  'A product''s constituents (PRD 871): its Statement (kind statement, at most one live) and its Never lines (kind never, display id never#<seq>, seq counted per product and never reused). Written only by constituent_add/edit/remove(), by a workspace owner; a removal sets removed_at and keeps the row.';

create table public.constituent_events (
  id             bigint generated always as identity primary key,
  workspace_id   uuid not null references public.workspaces on delete cascade,
  product_id     uuid not null references public.products on delete cascade,
  constituent_id uuid not null references public.constituents on delete cascade,
  action         text not null check (action in ('added', 'edited', 'removed', 'moved')),
  before         text,
  after          text,
  note           text check (note is null or char_length(note) between 1 and 200),
  claim_id       uuid references public.claims on delete set null,
  changed_by     uuid references auth.users on delete set null,
  changed_at     timestamptz not null default now(),
  check (claim_id is null or action = 'moved')
);

create index constituent_events_product_idx on public.constituent_events (product_id, id desc);
create index constituent_events_constituent_idx on public.constituent_events (constituent_id);

comment on table public.constituent_events is
  'The constituents'' history (PRD 871): one row per change, appended in the same transaction as the change. added: before null; edited: before and after; removed: after null; moved: a Never line moved from a confirmed `never` claim (claim_id), before null. changed_by: the owner who changed it, null for the move. The newest id of a product is the version a cached verdict is keyed by. Nobody updates or deletes a row.';

-- ── Helpers ──────────────────────────────────────────────────────────────────────

-- Refuses the caller unless they own the workspace.
create function public.constituents_owner_only(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace can change its constituents.' using errcode = '42501';
  end if;
end;
$$;

-- A constituent's text as an owner gave it: trimmed, on one line, 1 to 400 characters for a Statement
-- and 1 to 200 for a Never line, or 22023 naming `text`.
create function public.constituent_text(p_text text, p_kind text) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_text, ''));
  most integer := case when p_kind = 'statement' then 400 else 200 end;
begin
  if char_length(v) not between 1 and most or v ~ '[\r\n\t]' then
    raise exception 'Text: 1 to % characters, on one line.', most using errcode = '22023', hint = 'text';
  end if;
  return v;
end;
$$;

-- A live constituent of the workspace, locked for the write, or P0002.
create function public.constituent_live(p_workspace uuid, p_constituent uuid) returns public.constituents
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_one public.constituents;
begin
  select * into found_one from public.constituents c
   where c.id = p_constituent and c.workspace_id = p_workspace and c.removed_at is null
   for update;
  if not found then
    raise exception 'Constituent: no such line in this workspace, or it was removed.' using errcode = 'P0002', hint = 'constituent';
  end if;
  return found_one;
end;
$$;

-- ── The writes ───────────────────────────────────────────────────────────────────

-- An owner adds the product's Statement (22023 naming `kind` while one is live: edit it instead) or a
-- Never line, numbered after every line the product ever had. Logs `added`.
create function public.constituent_add(p_workspace uuid, p_product uuid, p_kind text, p_text text)
returns public.constituents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text;
  seq_next integer;
  made public.constituents;
begin
  perform public.constituents_owner_only(p_workspace);
  if p_kind is null or p_kind not in ('statement', 'never') then
    raise exception 'Kind: statement or never.' using errcode = '22023', hint = 'kind';
  end if;
  v := public.constituent_text(p_text, p_kind);
  perform public.business_product(p_workspace, p_product);
  -- The product's row is locked, so two adds never take one number or two Statements.
  perform 1 from public.products p where p.id = p_product for update;
  if p_kind = 'statement' then
    if exists (select 1 from public.constituents c
                where c.product_id = p_product and c.kind = 'statement' and c.removed_at is null) then
      raise exception 'Kind: this product has a Statement already; edit it.' using errcode = '22023', hint = 'kind';
    end if;
  else
    select coalesce(max(c.seq), 0) + 1 into seq_next from public.constituents c
     where c.product_id = p_product and c.kind = 'never';
  end if;
  insert into public.constituents (workspace_id, product_id, kind, seq, body, created_by)
  values (p_workspace, p_product, p_kind, seq_next, v, auth.uid())
  returning * into made;
  insert into public.constituent_events (workspace_id, product_id, constituent_id, action, before, after, changed_by)
  values (p_workspace, p_product, made.id, 'added', null, made.body, auth.uid());
  return made;
end;
$$;

-- An owner rewrites a live constituent. The same text changes nothing and logs nothing; anything else
-- logs `edited` with the text before and after.
create function public.constituent_edit(p_workspace uuid, p_constituent uuid, p_text text)
returns public.constituents
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.constituents;
  v text;
  made public.constituents;
begin
  perform public.constituents_owner_only(p_workspace);
  was := public.constituent_live(p_workspace, p_constituent);
  v := public.constituent_text(p_text, was.kind);
  if v = was.body then
    return was;
  end if;
  update public.constituents c set body = v, updated_at = now() where c.id = was.id returning * into made;
  insert into public.constituent_events (workspace_id, product_id, constituent_id, action, before, after, changed_by)
  values (p_workspace, was.product_id, was.id, 'edited', was.body, v, auth.uid());
  return made;
end;
$$;

-- An owner removes a live constituent: the row is kept, marked removed, and its id is never reused.
-- Logs `removed` with the text it had.
create function public.constituent_remove(p_workspace uuid, p_constituent uuid)
returns public.constituents
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.constituents;
  made public.constituents;
begin
  perform public.constituents_owner_only(p_workspace);
  was := public.constituent_live(p_workspace, p_constituent);
  update public.constituents c set removed_at = now(), removed_by = auth.uid(), updated_at = now()
   where c.id = was.id returning * into made;
  insert into public.constituent_events (workspace_id, product_id, constituent_id, action, before, after, changed_by)
  values (p_workspace, was.product_id, was.id, 'removed', was.body, null, auth.uid());
  return made;
end;
$$;

-- ── The reads ────────────────────────────────────────────────────────────────────

-- A product's live constituents as agents and the App read them: `{state, product, statement, never,
-- latestEventId}`. `statement`: `{id: 'statement', text}` or null; `never`: `[{id: 'never#<n>', text}]`
-- in their order; `latestEventId`: the product's newest event, as text (a bigint), or null.
-- `state` is `none` when there is no product or neither a Statement nor a Never line.
create function public.constituents_of_product(p_product uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  product public.products;
  stmt jsonb;
  lines jsonb;
  latest bigint;
begin
  select * into product from public.products p where p.id = p_product;
  if not found then
    return jsonb_build_object('state', 'none', 'product', null, 'statement', null, 'never', '[]'::jsonb, 'latestEventId', null);
  end if;
  select jsonb_build_object('id', 'statement', 'text', c.body) into stmt
    from public.constituents c
   where c.product_id = product.id and c.kind = 'statement' and c.removed_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id', 'never#' || c.seq, 'text', c.body) order by c.seq), '[]'::jsonb)
    into lines
    from public.constituents c
   where c.product_id = product.id and c.kind = 'never' and c.removed_at is null;
  select max(e.id) into latest from public.constituent_events e where e.product_id = product.id;
  return jsonb_build_object(
    'state', case when stmt is null and jsonb_array_length(lines) = 0 then 'none' else 'ok' end,
    'product', jsonb_build_object('name', product.name),
    'statement', stmt,
    'never', lines,
    'latestEventId', latest::text);
end;
$$;

-- What a terminal in `repo` reads (GET /api/constituents), as the caller: the constituents of the
-- repository's product in the caller's workspace that tracks it (business_workspace(): 42501 for a
-- repository outside the caller's workspaces, 22023 a malformed one).
create function public.constituents_for_repo(p_repo text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  product uuid;
begin
  select r.product_id into product from public.repositories r
   where r.workspace_id = ws and r.full_name = lower(btrim(p_repo));
  return public.constituents_of_product(product);
end;
$$;

-- What the omni-loop App reads for `repo`, with the service role (it signs in as nobody): the same
-- shape, for the workspace that tracks `repo` (the one whose GitHub org owns it first, then the oldest
-- to track it), as business_for_repo_app(). `none` when no workspace tracks it. A malformed `repo` is
-- 22023.
create function public.constituents_for_repo_app(p_repo text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  product uuid;
begin
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  select r.product_id into product
    from public.repositories r join public.workspaces w on w.id = r.workspace_id
   where r.full_name = v_repo and r.tracked
   order by (lower(w.github_org) is not distinct from split_part(v_repo, '/', 1)) desc, r.added_at, w.slug
   limit 1;
  return public.constituents_of_product(product);
end;
$$;

-- ── The move ─────────────────────────────────────────────────────────────────────

-- Moves every product's confirmed `never` claims into its Never list, in their order, each logged
-- `moved` ("moved from Business never#<seq>", the claim's id), and sets each claim `rejected`. Answers
-- how many moved. Run once below; a second run finds no confirmed `never` claim and moves nothing.
create function public.constituents_move_never_claims() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.claims;
  seq_next integer;
  made public.constituents;
  moved integer := 0;
begin
  for claim in
    select * from public.claims c
     where c.kind = 'never' and c.state = 'confirmed' and c.product_id is not null
     order by c.product_id, c.seq
     for update
  loop
    select coalesce(max(x.seq), 0) + 1 into seq_next from public.constituents x
     where x.product_id = claim.product_id and x.kind = 'never';
    insert into public.constituents (workspace_id, product_id, kind, seq, body, created_by, created_at)
    values (claim.workspace_id, claim.product_id, 'never', seq_next, claim.value, claim.created_by, now())
    returning * into made;
    insert into public.constituent_events (workspace_id, product_id, constituent_id, action, before, after, note, claim_id, changed_by)
    values (claim.workspace_id, claim.product_id, made.id, 'moved', null, made.body,
            'moved from Business never#' || claim.seq, claim.id, null);
    update public.claims c set state = 'rejected', updated_at = now() where c.id = claim.id;
    moved := moved + 1;
  end loop;
  return moved;
end;
$$;

select public.constituents_move_never_claims();

-- ── The claim kinds: nothing picks or proposes a Never line any more ─────────────

-- As 20261027090000_never_lines.sql, refusing `never`: a Never line is a constituent now, typed by an
-- owner (PRD 871).
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
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival') then
    raise exception 'Kind: region, offering, size, trade or rival.' using errcode = '22023', hint = 'kind';
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

-- As 20261027090000_never_lines.sql, refusing `never`: the draft and the recheck propose no Never line.
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
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival') then
    raise exception 'Kind: region, offering, size, trade or rival.' using errcode = '22023', hint = 'kind';
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

-- ── Jev: the inbox judge's decision ──────────────────────────────────────────────

-- As 20261026090000_jev_decisions.sql, with `constituent-break` (PRD 871): does a spec break the
-- product's Statement or a Never line.
create or replace function public.jev_decision_names() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['question-category', 'outbox-risk', 'bug-risk', 'constituent-break']
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.constituents enable row level security;
alter table public.constituent_events enable row level security;

create policy "a member reads their workspace's constituents" on public.constituents
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's constituent history" on public.constituent_events
  for select to authenticated using (public.is_member(workspace_id));

-- Signed out: nothing. Signed in: reads only, the rows above. Nobody, the service role included, writes
-- either table directly, and nobody updates or deletes an event.
revoke all on public.constituents, public.constituent_events from public, anon, authenticated, service_role;
grant select on public.constituents, public.constituent_events to authenticated, service_role;

revoke execute on function public.constituents_owner_only(uuid) from public, anon, authenticated;
revoke execute on function public.constituent_text(text, text) from public, anon, authenticated;
revoke execute on function public.constituent_live(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.constituents_of_product(uuid) from public, anon, authenticated;
revoke execute on function public.constituents_move_never_claims() from public, anon, authenticated, service_role;

revoke execute on function public.constituent_add(uuid, uuid, text, text) from public, anon;
grant execute on function public.constituent_add(uuid, uuid, text, text) to authenticated;
revoke execute on function public.constituent_edit(uuid, uuid, text) from public, anon;
grant execute on function public.constituent_edit(uuid, uuid, text) to authenticated;
revoke execute on function public.constituent_remove(uuid, uuid) from public, anon;
grant execute on function public.constituent_remove(uuid, uuid) to authenticated;
revoke execute on function public.constituents_for_repo(text) from public, anon;
grant execute on function public.constituents_for_repo(text) to authenticated;
revoke execute on function public.constituents_for_repo_app(text) from public, anon, authenticated;
grant execute on function public.constituents_for_repo_app(text) to service_role;
