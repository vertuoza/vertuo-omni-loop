-- Drafted from evidence (PRD 774, docs: .omni-loop/delivery/inbox/0774-business-evidence-draft/spec.md).
-- A draft reads a workspace's repositories and up to three pasted web pages, and proposes claims it can
-- quote word for word. This migration holds everything the draft, the page, the weekly recheck and the
-- bell call; no later slice of PRD 774 touches the database.
--
--   business_sources     the web pages pasted on a business: three at most (decision 3)
--   claim_receipts       where a claim was quoted: several per claim, each moved to now when quoted again (decision 8)
--   business_drafts      one row per run, `draft` or `recheck`; one running at a time per business (decision 10)
--   claims.replaces      a proposed offering or size that would replace a confirmed one, now `contradicted`
--
--   business_source_add(workspace, url) · business_source_remove(workspace, source)
--   business_draft_start(workspace, kind)            the running draft, or a new one
--   business_draft_progress(workspace, draft, counts, scanned) · business_draft_finish(workspace, draft, state, counts, scanned, reason)
--   claim_propose_evidence(workspace, product, kind, value, receipts)   decision 9's merge, for one verified candidate
--   claims_confirm_proposed(workspace, rejected)      ✓ That's us: every proposed evidence claim not marked ✗
--   claim_settle_replacement(workspace, claim, right) ✓ confirms the new and rejects the old; ✗ the reverse
--   claim_still_true(workspace, claim)                ✓ Still true on a faded claim: last_seen is now
--   business_to_check(workspace)                      the count the bell shows: proposed evidence, contradictions, faded claims
--   business_for_repo(repo)                           now confirmed and contradicted claims, each with `state` (decision 12)
--
-- Every write goes through a security-definer function, built like 20261019090000_business_store.sql:
-- 42501 (not a member), P0002 (gone), 22023 (invalid, the field in `hint`). The functions the draft and
-- the recheck run (starting, progressing and finishing a draft, proposing evidence) also take the
-- service role, which the weekly recheck acts as; everything a person presses takes members only.
--
-- Proven by supabase/checks/business.sql.
-- Rollback: set every contradicted claim back to confirmed, then a follow-up migration drops
-- business_drafts, claim_receipts, business_sources, claims.replaces and the functions below, and
-- restores business_for_repo() and claim_set_state() from 20261019090000_business_store.sql.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.business_sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  business_id  uuid not null references public.businesses on delete cascade,
  url          text not null check (char_length(url) between 9 and 2000 and url ~ '^https://[^[:space:]]+$'),
  added_by     uuid references auth.users on delete set null,
  added_at     timestamptz not null default now()
);

create unique index business_sources_url_idx on public.business_sources (business_id, lower(url));

comment on table public.business_sources is
  'The web pages a member pasted on a business for the draft to read (PRD 774, decision 3): three at most, https only. Whether an address is public is checked where the page is fetched.';

create table public.claim_receipts (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  claim_id     uuid not null references public.claims on delete cascade,
  kind         text not null check (kind in ('file', 'pr', 'link')),
  location     text not null check (char_length(location) between 1 and 500),
  quote        text not null check (char_length(quote) between 1 and 300),
  seen_at      timestamptz not null default now()
);

create unique index claim_receipts_quote_idx on public.claim_receipts (claim_id, kind, location, quote);
create index claim_receipts_claim_idx on public.claim_receipts (claim_id, seen_at desc);

comment on table public.claim_receipts is
  'Where a claim was quoted (PRD 774, decision 8): kind file | pr | link, location a repository path or a URL, the quote word for word. The same quote seen again moves seen_at to now; claims.last_seen is the newest seen_at.';

create table public.business_drafts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  business_id  uuid not null references public.businesses on delete cascade,
  kind         text not null check (kind in ('draft', 'recheck')),
  state        text not null default 'running' check (state in ('running', 'done', 'failed')),
  started_by   uuid references auth.users on delete set null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  counts       jsonb not null default '{}'::jsonb check (jsonb_typeof(counts) = 'object'),
  scanned      jsonb not null default '[]'::jsonb check (jsonb_typeof(scanned) = 'array'),
  reason       text check (reason is null or char_length(reason) between 1 and 500),
  check ((state = 'running') = (finished_at is null)),
  check ((state = 'failed') = (reason is not null))
);

-- One running draft per business (decision 10).
create unique index business_drafts_running_idx on public.business_drafts (business_id) where state = 'running';
create index business_drafts_business_idx on public.business_drafts (business_id, started_at desc);

comment on table public.business_drafts is
  'One run of the draft (PRD 774, decision 10): kind draft (a member''s click) or recheck (the weekly wake-up, started_by null). counts: what it read, by the draft''s own keys; scanned: each source as read or skipped, for the page to show while it runs; reason: why it failed.';

alter table public.claims add column replaces uuid references public.claims on delete set null;
create index claims_replaces_idx on public.claims (replaces) where replaces is not null;

comment on column public.claims.replaces is
  'A proposed offering or size the evidence found in place of a confirmed one (PRD 774, decision 9): the claim it would replace, which is contradicted until someone answers.';
comment on column public.claims.last_seen is
  'When evidence last quoted the claim: the newest seen_at of its receipts, or when someone said it is still true. Null for a claim no source quoted.';

-- ── Who may write ────────────────────────────────────────────────────────────────

-- The service role (the weekly recheck) or a member of the workspace; anyone else 42501.
create function public.business_runner_only(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.role() is not distinct from 'service_role' then
    return;
  end if;
  perform public.business_member_only(p_workspace);
end;
$$;

-- A size is `<min>-<max>` of the slider's stops, or 22023 naming `value`.
create function public.business_size_check(p_value text) returns void
language plpgsql immutable
set search_path = ''
as $$
declare
  lo text := split_part(p_value, '-', 1);
  hi text := substr(p_value, char_length(split_part(p_value, '-', 1)) + 2);
begin
  if p_value !~ '^[0-9]+\+?-[0-9]+\+?$' or public.business_size_stop(lo) is null or public.business_size_stop(hi) is null
     or public.business_size_stop(lo) > public.business_size_stop(hi) then
    raise exception 'Size: <min>-<max>, each one of 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000+.' using errcode = '22023', hint = 'value';
  end if;
end;
$$;

-- A running draft of the workspace, or P0002.
create function public.business_draft_running(p_workspace uuid, p_draft uuid) returns public.business_drafts
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one public.business_drafts;
begin
  select * into found_one from public.business_drafts d
   where d.id = p_draft and d.workspace_id = p_workspace and d.state = 'running';
  if not found then
    raise exception 'Draft: no running draft by that id in this workspace.' using errcode = 'P0002', hint = 'draft';
  end if;
  return found_one;
end;
$$;

-- counts must be a JSON object and scanned a JSON array, when given.
create function public.business_draft_shape(p_counts jsonb, p_scanned jsonb) returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_counts is not null and jsonb_typeof(p_counts) <> 'object' then
    raise exception 'Counts: a JSON object.' using errcode = '22023', hint = 'counts';
  end if;
  if p_scanned is not null and jsonb_typeof(p_scanned) <> 'array' then
    raise exception 'Scanned: a JSON array.' using errcode = '22023', hint = 'scanned';
  end if;
end;
$$;

-- ── Web pages ────────────────────────────────────────────────────────────────────

-- Adds a web page to the business's sources: https only, three at most. The same page again answers
-- the one already there.
create function public.business_source_add(p_workspace uuid, p_url text) returns public.business_sources
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz public.businesses;
  v text := btrim(coalesce(p_url, ''));
  made public.business_sources;
begin
  perform public.business_member_only(p_workspace);
  if char_length(v) not between 9 and 2000 or v !~* '^https://[^[:space:]/]+[^[:space:]]*$' then
    raise exception 'Web page: an https:// address, up to 2000 characters.' using errcode = '22023', hint = 'url';
  end if;
  select * into biz from public.businesses b where b.workspace_id = p_workspace for update;
  if not found then
    raise exception 'Business: this workspace has none yet.' using errcode = 'P0002', hint = 'business';
  end if;
  select * into made from public.business_sources s where s.business_id = biz.id and lower(s.url) = lower(v);
  if found then
    return made;
  end if;
  if (select count(*) from public.business_sources s where s.business_id = biz.id) >= 3 then
    raise exception 'Web page: three at most. Remove one first.' using errcode = '22023', hint = 'url';
  end if;
  insert into public.business_sources (workspace_id, business_id, url, added_by)
  values (p_workspace, biz.id, v, auth.uid())
  returning * into made;
  return made;
end;
$$;

-- Removes a web page from the business's sources.
create function public.business_source_remove(p_workspace uuid, p_source uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.business_member_only(p_workspace);
  delete from public.business_sources s where s.id = p_source and s.workspace_id = p_workspace;
  if not found then
    raise exception 'Web page: no such web page on this business.' using errcode = 'P0002', hint = 'source';
  end if;
end;
$$;

-- ── Drafts ───────────────────────────────────────────────────────────────────────

-- Starts a draft (a member's click) or a recheck (the weekly wake-up). While one runs, it answers the
-- running one (decision 10). A draft still running after 15 minutes has died with its function: it is
-- marked failed, and a new one starts.
create function public.business_draft_start(p_workspace uuid, p_kind text default 'draft') returns public.business_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz public.businesses;
  running public.business_drafts;
  made public.business_drafts;
begin
  perform public.business_runner_only(p_workspace);
  if p_kind is null or p_kind not in ('draft', 'recheck') then
    raise exception 'Kind: draft or recheck.' using errcode = '22023', hint = 'kind';
  end if;
  select * into biz from public.businesses b where b.workspace_id = p_workspace for update;
  if not found then
    raise exception 'Business: this workspace has none yet.' using errcode = 'P0002', hint = 'business';
  end if;
  select * into running from public.business_drafts d where d.business_id = biz.id and d.state = 'running';
  if found then
    if running.started_at > now() - interval '15 minutes' then
      return running;
    end if;
    update public.business_drafts d set state = 'failed', finished_at = now(), reason = 'It stopped answering.'
     where d.id = running.id;
  end if;
  insert into public.business_drafts (workspace_id, business_id, kind, started_by)
  values (p_workspace, biz.id, p_kind, auth.uid())
  returning * into made;
  return made;
end;
$$;

-- What a running draft has read so far, for the page to show while it runs. A null leaves that field.
create function public.business_draft_progress(p_workspace uuid, p_draft uuid, p_counts jsonb, p_scanned jsonb)
returns public.business_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.business_drafts;
begin
  perform public.business_runner_only(p_workspace);
  perform public.business_draft_shape(p_counts, p_scanned);
  perform public.business_draft_running(p_workspace, p_draft);
  update public.business_drafts d set counts = coalesce(p_counts, d.counts), scanned = coalesce(p_scanned, d.scanned)
   where d.id = p_draft
  returning * into changed;
  return changed;
end;
$$;

-- Ends a running draft: done, or failed with why.
create function public.business_draft_finish(p_workspace uuid, p_draft uuid, p_state text, p_counts jsonb default null,
                                             p_scanned jsonb default null, p_reason text default null)
returns public.business_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  changed public.business_drafts;
begin
  perform public.business_runner_only(p_workspace);
  if p_state is null or p_state not in ('done', 'failed') then
    raise exception 'State: done or failed.' using errcode = '22023', hint = 'state';
  end if;
  if p_state = 'failed' and (why is null or char_length(why) > 500) then
    raise exception 'Reason: a failed draft says why, in up to 500 characters.' using errcode = '22023', hint = 'reason';
  end if;
  perform public.business_draft_shape(p_counts, p_scanned);
  perform public.business_draft_running(p_workspace, p_draft);
  update public.business_drafts d
     set state = p_state, finished_at = now(), counts = coalesce(p_counts, d.counts), scanned = coalesce(p_scanned, d.scanned),
         reason = case when p_state = 'failed' then why end
   where d.id = p_draft
  returning * into changed;
  return changed;
end;
$$;

-- ── Evidence ─────────────────────────────────────────────────────────────────────

-- Adds or moves a claim's receipts, then keeps its last_seen equal to the newest.
create function public.claim_receipts_add(p_claim public.claims, p_receipts jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  for r in select * from jsonb_array_elements(p_receipts) loop
    insert into public.claim_receipts (workspace_id, claim_id, kind, location, quote)
    values (p_claim.workspace_id, p_claim.id, r->>'kind', btrim(r->>'where'), r->>'quote')
    on conflict (claim_id, kind, location, quote) do update set seen_at = now();
  end loop;
  update public.claims c
     set last_seen = (select max(x.seen_at) from public.claim_receipts x where x.claim_id = c.id), updated_at = now()
   where c.id = p_claim.id;
end;
$$;

-- One verified candidate of a draft, merged with the store as decision 9 says. `receipts` is a JSON
-- array of 1 to 20 `{kind: file | pr | link, where, quote}`; the quote is up to 300 characters and was
-- checked word for word by the draft. A size is sent already snapped to the slider's stops. Answers
-- `{outcome, id}`:
--   added      no claim of that value: a proposed evidence claim, with its receipts
--   replacing  offering or size, another value confirmed: a proposed claim that replaces it, now contradicted
--   seen       the value is there (confirmed, proposed or contradicted): its receipts added or moved
--   rejected   the value was rejected: nothing changes, and `id` is null
create function public.claim_propose_evidence(p_workspace uuid, p_product uuid, p_kind text, p_value text, p_receipts jsonb)
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
  v := public.business_text(p_value, 'value', 'Value');
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

-- ✓ That's us: confirms every proposed evidence claim of the business that is not a replacement,
-- except those marked ✗ (`rejected`), which are rejected. Answers how many were confirmed.
create function public.claims_confirm_proposed(p_workspace uuid, p_rejected uuid[] default '{}') returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmed integer;
begin
  perform public.business_member_only(p_workspace);
  update public.claims c set state = 'rejected', updated_at = now()
   where c.workspace_id = p_workspace and c.state = 'proposed' and c.source = 'evidence' and c.replaces is null
     and c.id = any (coalesce(p_rejected, '{}'));
  update public.claims c set state = 'confirmed', updated_at = now()
   where c.workspace_id = p_workspace and c.state = 'proposed' and c.source = 'evidence' and c.replaces is null;
  get diagnostics confirmed = row_count;
  return confirmed;
end;
$$;

-- Settles a replacement: ✓ Right (`right` true) confirms the new claim and rejects the one it
-- replaces; ✗ Wrong rejects the new claim and confirms the old one again. Answers the new claim.
create function public.claim_settle_replacement(p_workspace uuid, p_claim uuid, p_right boolean) returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  newer public.claims;
begin
  perform public.business_member_only(p_workspace);
  if p_right is null then
    raise exception 'Right: true or false.' using errcode = '22023', hint = 'right';
  end if;
  select * into newer from public.claims c
   where c.id = p_claim and c.workspace_id = p_workspace and c.state = 'proposed' and c.replaces is not null;
  if not found then
    raise exception 'Claim: no replacement waiting by that id in this workspace.' using errcode = 'P0002', hint = 'claim';
  end if;
  update public.claims c set state = case when p_right then 'rejected' else 'confirmed' end, updated_at = now()
   where c.id = newer.replaces and c.state = 'contradicted';
  update public.claims c set state = case when p_right then 'confirmed' else 'rejected' end, updated_at = now()
   where c.id = newer.id
  returning * into newer;
  return newer;
end;
$$;

-- ✓ Right and ✗ Wrong, as in 20261019090000_business_store.sql; on a replacement they settle it with
-- the claim it replaces.
create or replace function public.claim_set_state(p_workspace uuid, p_claim uuid, p_state text) returns public.claims
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
  if exists (select 1 from public.claims c where c.id = p_claim and c.workspace_id = p_workspace
                                               and c.state = 'proposed' and c.replaces is not null) then
    return public.claim_settle_replacement(p_workspace, p_claim, p_state = 'confirmed');
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

-- ✓ Still true on a faded claim: its last_seen is now, so it no longer fades.
create function public.claim_still_true(p_workspace uuid, p_claim uuid) returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.claims;
begin
  perform public.business_member_only(p_workspace);
  update public.claims c set last_seen = now(), updated_at = now()
   where c.id = p_claim and c.workspace_id = p_workspace and c.state = 'confirmed'
  returning * into changed;
  if not found then
    raise exception 'Claim: no confirmed claim by that id in this workspace.' using errcode = 'P0002', hint = 'claim';
  end if;
  return changed;
end;
$$;

-- What waits to be checked on the business (the bell's "Business · N to check"): each proposed evidence
-- claim (a replacement counts once, its contradicted claim with it) and each faded claim, a confirmed
-- one with receipts that no source quoted for eight weeks (decision 13). 0 with no business.
create function public.business_to_check(p_workspace uuid) returns integer
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform public.business_member_only(p_workspace);
  return (
    select count(*)::integer from public.claims c
     where c.workspace_id = p_workspace
       and ((c.state = 'proposed' and c.source = 'evidence')
            or (c.state = 'confirmed' and c.last_seen < now() - interval '8 weeks'
                and exists (select 1 from public.claim_receipts x where x.claim_id = c.id))));
end;
$$;

-- ── What the kit calls ───────────────────────────────────────────────────────────

-- What agents in `repo` read (PRD 748's decision 14, grown by PRD 774's decision 12): confirmed and
-- contradicted claims, each with its `state`; `receipt` is the newest receipt as `<where> — "<quote>"`,
-- or the claim's own receipt when it has none. Proposed and rejected claims never leave the app.
create or replace function public.business_for_repo(p_repo text) returns jsonb
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
  return jsonb_build_object(
    'state', case when jsonb_array_length(listed) = 0 then 'none' else 'ok' end,
    'business', jsonb_build_object('name', biz.name),
    'product', case when products_count > 1 and product.id is not null then jsonb_build_object('name', product.name) end,
    'claims', listed);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.business_sources enable row level security;
alter table public.claim_receipts enable row level security;
alter table public.business_drafts enable row level security;

create policy "a member reads their workspace's web pages" on public.business_sources
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's receipts" on public.claim_receipts
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's drafts" on public.business_drafts
  for select to authenticated using (public.is_member(workspace_id));

-- Signed out: nothing. Signed in: reads only, the rows above. Nobody, the service role included,
-- writes these tables directly.
revoke all on public.business_sources, public.claim_receipts, public.business_drafts
  from public, anon, authenticated, service_role;
grant select on public.business_sources, public.claim_receipts, public.business_drafts to authenticated, service_role;

revoke execute on function public.business_runner_only(uuid) from public, anon, authenticated;
revoke execute on function public.business_size_check(text) from public, anon, authenticated;
revoke execute on function public.business_draft_running(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.business_draft_shape(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_receipts_add(public.claims, jsonb) from public, anon, authenticated, service_role;

-- What a person presses: members only.
revoke execute on function public.business_source_add(uuid, text) from public, anon;
grant execute on function public.business_source_add(uuid, text) to authenticated;
revoke execute on function public.business_source_remove(uuid, uuid) from public, anon;
grant execute on function public.business_source_remove(uuid, uuid) to authenticated;
revoke execute on function public.claims_confirm_proposed(uuid, uuid[]) from public, anon;
grant execute on function public.claims_confirm_proposed(uuid, uuid[]) to authenticated;
revoke execute on function public.claim_settle_replacement(uuid, uuid, boolean) from public, anon;
grant execute on function public.claim_settle_replacement(uuid, uuid, boolean) to authenticated;
revoke execute on function public.claim_still_true(uuid, uuid) from public, anon;
grant execute on function public.claim_still_true(uuid, uuid) to authenticated;
revoke execute on function public.business_to_check(uuid) from public, anon;
grant execute on function public.business_to_check(uuid) to authenticated;

-- What the draft and the recheck run: a member, or the service role.
revoke execute on function public.business_draft_start(uuid, text) from public, anon;
grant execute on function public.business_draft_start(uuid, text) to authenticated, service_role;
revoke execute on function public.business_draft_progress(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.business_draft_progress(uuid, uuid, jsonb, jsonb) to authenticated, service_role;
revoke execute on function public.business_draft_finish(uuid, uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.business_draft_finish(uuid, uuid, text, jsonb, jsonb, text) to authenticated, service_role;
revoke execute on function public.claim_propose_evidence(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.claim_propose_evidence(uuid, uuid, text, text, jsonb) to authenticated, service_role;
