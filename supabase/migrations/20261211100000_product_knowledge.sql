-- A product's knowledge: its Legal entries and its glossary (PRD 1795 s1, docs:
-- .omni-loop/delivery/inbox/1795-product-knowledge-page/spec.md). Shared by every repository the product
-- links, written the way the constituents are (20261029090000_constituents.sql): every member of the
-- workspace reads, nobody signed in writes a table directly, and every change goes through a definer
-- function that checks the caller's role and appends its event in the same transaction.
--
--   product_knowledge_owners      per product and kind (legal, glossary), its owner and its delegate,
--                                 each a member of the workspace. Not product_approvers: approving a
--                                 PRD's phase 0 and answering for the law are different jobs
--   product_legal                 a Legal entry: `L-<code>-<number>`, one sentence of what the law
--                                 requires, its source law, its owner. The number is the next for its
--                                 code in its product, counted over every entry it ever had, so it is
--                                 never reused. Retired, never deleted
--   product_glossary              a term, its meaning, the words to avoid in its place. Unique among the
--                                 product's live terms without case; removed, never deleted
--   product_knowledge_proposals   a member's proposed addition, edit, retirement or removal: open, then
--                                 approved or rejected, with who decided it and when
--   product_knowledge_events      the log: one row per change (added, edited, retired, removed, proposed,
--                                 approved, rejected, named), the fields before and after. Appended in
--                                 the same transaction as the change; nobody updates or deletes one
--
--   product_knowledge_name(workspace, product, kind, role, user)   a workspace owner names, changes or
--                                                                  (user null) clears an owner or delegate
--   product_legal_add / _edit / _retire                            the Legal owner or delegate, directly
--   product_glossary_add / _edit / _remove                         the Glossary owner or delegate, directly
--   product_knowledge_propose(workspace, product, kind, action, entry, fields)   any member
--   product_knowledge_approve / _reject(workspace, proposal)       the kind's owner or delegate
--   product_knowledge_of(workspace, product)                       the Knowledge tab's read, a member's
--   business_for_product(), business_for_repo_app()                agents' and the App's reads gain
--                                                                  `legal` and `glossary`
--
-- Who decides a kind: its owner or its delegate while they are members of the workspace; while it names
-- neither, the workspace's owners. Refusals as the business store's: 42501 not allowed (not a member, or
-- may only propose), P0002 no such product, entry or open proposal, 22023 a bad value with the field in
-- `hint`.
--
-- The reads: business_for_product() (what business_for_repo() answers a terminal and
-- business_for_token() an agent's link) and business_for_repo_app() (the canon gate's) gain `legal`, the
-- product's active entries `{id: "L-<CODE>-<n>", statement, source, owner}` (the owner's login) ordered
-- by code then number, and `glossary`, its live terms `{term, meaning, avoid}` ordered by term without
-- case; each `[]` with none, or with no product. business_for_repo_app() also answers
-- `knowledgeEventId`, the product's newest event id as text (null with none): the canon gate's verdict
-- cache key gains it, so a changed entry re-judges (ADR-0066).
--
-- Nothing is seeded. Proven by supabase/checks/product_knowledge.sql, the two reads' fields by
-- supabase/checks/business.sql.
--
-- Rollback: a follow-up migration restores business_for_product() from 20261028090000_agent_tokens.sql
-- and business_for_repo_app() from 20261129110000_product_lookups.sql, then drops the functions below and
-- the five tables; nothing else reads them.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.product_knowledge_owners (
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  kind         text not null check (kind in ('legal', 'glossary')),
  role         text not null check (role in ('owner', 'delegate')),
  user_id      uuid not null references auth.users on delete cascade,
  named_by     uuid references auth.users on delete set null,
  named_at     timestamptz not null default now(),
  primary key (product_id, kind, role)
);

create index product_knowledge_owners_workspace_idx on public.product_knowledge_owners (workspace_id);

comment on table public.product_knowledge_owners is
  'Who answers for a product''s knowledge (PRD 1795): per kind (legal, glossary), one owner and one delegate, each a member of the workspace. Written only by product_knowledge_name(), by a workspace owner. A named person who left the workspace names nobody.';

create table public.product_legal (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  code         text not null check (code ~ '^[A-Z][A-Z0-9]{0,39}$'),
  -- The entry's number, counted per product and code over every entry it ever had.
  number       integer not null check (number > 0),
  statement    text not null check (char_length(statement) between 1 and 400),
  source       text not null check (char_length(source) between 1 and 500),
  owner_id     uuid references auth.users on delete set null,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  retired_at   timestamptz,
  retired_by   uuid references auth.users on delete set null,
  unique (product_id, code, number)
);

create index product_legal_workspace_idx on public.product_legal (workspace_id);

comment on table public.product_legal is
  'A product''s Legal entries (PRD 1795): what the law requires, display id L-<code>-<number>, the number counted per product and code and never reused. Written only by product_legal_add/edit/retire() and an approved proposal; retiring sets retired_at and keeps the row.';

create table public.product_glossary (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  term         text not null check (char_length(term) between 1 and 80),
  meaning      text not null check (char_length(meaning) between 1 and 400),
  avoid        text[] not null default '{}' check (cardinality(avoid) <= 20),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  removed_at   timestamptz,
  removed_by   uuid references auth.users on delete set null
);

-- A live term is unique in its product without case; a removed one stays beside its successor.
create unique index product_glossary_live_term_idx on public.product_glossary (product_id, lower(term)) where removed_at is null;
create index product_glossary_workspace_idx on public.product_glossary (workspace_id);

comment on table public.product_glossary is
  'A product''s glossary (PRD 1795): a term, its meaning in one sentence, the words to avoid in its place. Written only by product_glossary_add/edit/remove() and an approved proposal; removing sets removed_at and keeps the row.';

create table public.product_knowledge_proposals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  kind         text not null check (kind in ('legal', 'glossary')),
  action       text not null,
  -- The entry an edit, a retirement or a removal is for; an approved addition's new entry.
  legal_id     uuid references public.product_legal on delete cascade,
  glossary_id  uuid references public.product_glossary on delete cascade,
  -- The proposed fields, as product_knowledge_fields() checked them.
  fields       jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  proposed_by  uuid references auth.users on delete set null,
  proposed_at  timestamptz not null default now(),
  state        text not null default 'open' check (state in ('open', 'approved', 'rejected')),
  decided_by   uuid references auth.users on delete set null,
  decided_at   timestamptz,
  check ((kind = 'legal' and action in ('add', 'edit', 'retire')) or (kind = 'glossary' and action in ('add', 'edit', 'remove'))),
  check (kind = 'legal' or legal_id is null),
  check (kind = 'glossary' or glossary_id is null),
  check (action = 'add' or legal_id is not null or glossary_id is not null),
  check ((state = 'open') = (decided_at is null))
);

create index product_knowledge_proposals_product_idx on public.product_knowledge_proposals (product_id, state);
create index product_knowledge_proposals_workspace_idx on public.product_knowledge_proposals (workspace_id);

comment on table public.product_knowledge_proposals is
  'A member''s proposed change to a product''s knowledge (PRD 1795): add, edit or retire a Legal entry, add, edit or remove a term. Open until the kind''s owner or delegate approves it (the change is made as proposed) or rejects it (nothing changes); either way it is kept, with who decided and when.';

create table public.product_knowledge_events (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  kind         text not null check (kind in ('legal', 'glossary')),
  action       text not null check (action in ('added', 'edited', 'retired', 'removed', 'proposed', 'approved', 'rejected', 'named')),
  legal_id     uuid references public.product_legal on delete cascade,
  glossary_id  uuid references public.product_glossary on delete cascade,
  proposal_id  uuid references public.product_knowledge_proposals on delete cascade,
  before       jsonb,
  after        jsonb,
  changed_by   uuid references auth.users on delete set null,
  changed_at   timestamptz not null default now(),
  check (legal_id is null or glossary_id is null),
  check ((action in ('proposed', 'approved', 'rejected')) = (proposal_id is not null))
);

create index product_knowledge_events_product_idx on public.product_knowledge_events (product_id, id desc);
create index product_knowledge_events_workspace_idx on public.product_knowledge_events (workspace_id);

comment on table public.product_knowledge_events is
  'The history of a product''s knowledge (PRD 1795): one row per change, appended in the same transaction as the change. added: before null; edited: before and after; retired and removed: after null; proposed: the proposal and its fields (after); approved: the change it made; rejected: no fields; named: an owner or delegate, {role, user} before and after. The newest id of a product is the version the canon gate''s cached verdict is keyed by. Nobody updates or deletes a row.';

-- ── Helpers ──────────────────────────────────────────────────────────────────────

-- Refuses the caller unless they are a member of the workspace.
create function public.product_knowledge_member_only(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can read or change its products'' knowledge.' using errcode = '42501';
  end if;
end;
$$;

-- A product of the workspace the caller is a member of: 42501, else P0002 naming `product`.
create function public.product_knowledge_product(p_workspace uuid, p_product uuid) returns public.products
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform public.product_knowledge_member_only(p_workspace);
  return public.business_product(p_workspace, p_product);
end;
$$;

-- The kind, or 22023 naming `kind`.
create function public.product_knowledge_kind(p_kind text) returns text
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('legal', 'glossary') then
    raise exception 'Kind: legal or glossary.' using errcode = '22023', hint = 'kind';
  end if;
  return p_kind;
end;
$$;

-- A value as a person gave it: trimmed, 1 to `p_most` characters on one line, or 22023 naming `p_field`.
create function public.product_knowledge_text(p_value text, p_field text, p_label text, p_most integer) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if char_length(v) not between 1 and p_most or v ~ '[\r\n\t]' then
    raise exception '%: 1 to % characters, on one line.', p_label, p_most using errcode = '22023', hint = p_field;
  end if;
  return v;
end;
$$;

-- The members a product names for a kind who are still members of its workspace.
create function public.product_knowledge_named(p_product uuid, p_kind text) returns setof public.product_knowledge_owners
language sql stable
security definer
set search_path = ''
as $$
  select o.* from public.product_knowledge_owners o
    join public.workspace_members m on m.workspace_id = o.workspace_id and m.user_id = o.user_id
   where o.product_id = p_product and o.kind = p_kind
$$;

-- True when the caller decides a kind of the product: its owner or delegate, or, while it names
-- neither, an owner of the product's workspace.
create function public.product_knowledge_decides(p_product uuid, p_kind text) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.product_knowledge_named(p_product, p_kind))
      then exists (select 1 from public.product_knowledge_named(p_product, p_kind) n where n.user_id = (select auth.uid()))
    else exists (select 1 from public.products p
                   join public.workspace_members m on m.workspace_id = p.workspace_id
                  where p.id = p_product and m.user_id = (select auth.uid()) and m.role = 'owner')
  end
$$;

-- Refuses the caller unless they decide the kind (42501, saying to propose instead).
create function public.product_knowledge_decider_only(p_product uuid, p_kind text) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if not public.product_knowledge_decides(p_product, p_kind) then
    if p_kind = 'legal' then
      raise exception 'Only the Legal owner or delegate changes Legal entries: propose the change instead.' using errcode = '42501';
    end if;
    raise exception 'Only the Glossary owner or delegate changes the glossary: propose the change instead.' using errcode = '42501';
  end if;
end;
$$;

-- The fields of a change of `p_kind` by `p_action`, checked and normalized, or 22023 naming the field:
--   legal add      {code, statement, source, owner}; owner defaults to `p_owner`
--   legal edit     any of {statement, source, owner}, at least one; the code and number never change
--   glossary add   {term, meaning, avoid}; avoid defaults to []
--   glossary edit  any of {term, meaning, avoid}, at least one
--   retire, remove nothing
-- code: one word of capital letters and digits, starting with a letter, at most 40 (upper-cased);
-- statement and meaning: 1 to 400 characters on one line; source: 1 to 500; term: 1 to 80; owner: a
-- member of the workspace (its user id); avoid: at most 20 words of 1 to 80 characters, trimmed, the
-- second of two that differ only by case dropped.
create function public.product_knowledge_fields(p_workspace uuid, p_kind text, p_action text, p_fields jsonb, p_owner uuid)
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  f jsonb := coalesce(p_fields, '{}'::jsonb);
  allowed text[];
  key text;
  out jsonb := '{}'::jsonb;
  adding boolean := p_action = 'add';
  v text;
  owner_text text;
  owner uuid;
  word jsonb;
  words text[] := '{}';
begin
  if jsonb_typeof(f) <> 'object' then
    raise exception 'Fields: an object of the fields to change.' using errcode = '22023', hint = 'fields';
  end if;
  if p_action is null or (p_kind = 'legal' and p_action not in ('add', 'edit', 'retire'))
     or (p_kind = 'glossary' and p_action not in ('add', 'edit', 'remove')) then
    raise exception 'Action: add, edit or retire a Legal entry; add, edit or remove a term.' using errcode = '22023', hint = 'action';
  end if;
  allowed := case
    when p_action in ('retire', 'remove') then '{}'::text[]
    when p_kind = 'legal' and adding then array['code', 'statement', 'source', 'owner']
    when p_kind = 'legal' then array['statement', 'source', 'owner']
    else array['term', 'meaning', 'avoid'] end;
  for key in select jsonb_object_keys(f) loop
    if not key = any (allowed) then
      raise exception 'Fields: % is not a field of this change.', key using errcode = '22023', hint = key;
    end if;
  end loop;
  if p_action = 'edit' and f = '{}'::jsonb then
    raise exception 'Fields: name at least one field to change.' using errcode = '22023', hint = 'fields';
  end if;

  if p_kind = 'legal' then
    if adding then
      v := upper(btrim(coalesce(f->>'code', '')));
      if v !~ '^[A-Z][A-Z0-9]{0,39}$' then
        raise exception 'Code: one word of letters and digits, starting with a letter, at most 40 (INVOICING).' using errcode = '22023', hint = 'code';
      end if;
      out := out || jsonb_build_object('code', v);
    end if;
    if adding or f ? 'statement' then
      out := out || jsonb_build_object('statement', public.product_knowledge_text(f->>'statement', 'statement', 'Statement', 400));
    end if;
    if adding or f ? 'source' then
      out := out || jsonb_build_object('source', public.product_knowledge_text(f->>'source', 'source', 'Source law', 500));
    end if;
    if adding or f ? 'owner' then
      owner_text := case when jsonb_typeof(f->'owner') = 'string' then f->>'owner' end;
      if f ? 'owner' and owner_text is null and jsonb_typeof(f->'owner') <> 'null' then
        owner_text := '';
      end if;
      if owner_text is null then
        owner := case when adding then p_owner end;
      elsif owner_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        owner := owner_text::uuid;
      end if;
      if owner is null or not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = owner) then
        raise exception 'Owner: a member of the workspace.' using errcode = '22023', hint = 'owner';
      end if;
      out := out || jsonb_build_object('owner', owner);
    end if;
  elsif p_action in ('add', 'edit') then
    if adding or f ? 'term' then
      out := out || jsonb_build_object('term', public.product_knowledge_text(f->>'term', 'term', 'Term', 80));
    end if;
    if adding or f ? 'meaning' then
      out := out || jsonb_build_object('meaning', public.product_knowledge_text(f->>'meaning', 'meaning', 'Meaning', 400));
    end if;
    if adding or f ? 'avoid' then
      if f ? 'avoid' and jsonb_typeof(f->'avoid') <> 'null'
         and (jsonb_typeof(f->'avoid') <> 'array' or jsonb_array_length(f->'avoid') > 20) then
        raise exception 'Avoid: at most 20 words, each 1 to 80 characters on one line.' using errcode = '22023', hint = 'avoid';
      end if;
      for word in select * from jsonb_array_elements(case when jsonb_typeof(f->'avoid') = 'array' then f->'avoid' else '[]'::jsonb end) loop
        if jsonb_typeof(word) <> 'string' then
          raise exception 'Avoid: at most 20 words, each 1 to 80 characters on one line.' using errcode = '22023', hint = 'avoid';
        end if;
        v := public.product_knowledge_text(word #>> '{}', 'avoid', 'Avoid: each word', 80);
        if not lower(v) = any (select lower(w) from unnest(words) w) then
          words := words || v;
        end if;
      end loop;
      out := out || jsonb_build_object('avoid', to_jsonb(words));
    end if;
  end if;
  return out;
end;
$$;

-- An entry's fields, as events and proposals record them.
create function public.product_legal_fields(e public.product_legal) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('code', e.code, 'number', e.number, 'statement', e.statement, 'source', e.source, 'owner', e.owner_id)
$$;

create function public.product_glossary_fields(e public.product_glossary) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('term', e.term, 'meaning', e.meaning, 'avoid', to_jsonb(e.avoid))
$$;

-- 22023 naming `term` when the product has another live term spelled `p_term` without case.
create function public.product_glossary_unique(p_product uuid, p_term text, p_except uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.product_glossary g
              where g.product_id = p_product and g.removed_at is null and lower(g.term) = lower(p_term)
                and g.id is distinct from p_except) then
    raise exception 'Term: the glossary has % already.', p_term using errcode = '22023', hint = 'term';
  end if;
end;
$$;

-- A live entry of the product, locked for the write (by id, of the workspace when `p_product` is null),
-- or P0002 naming `entry`.
create function public.product_legal_live(p_workspace uuid, p_product uuid, p_entry uuid) returns public.product_legal
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_one public.product_legal;
begin
  select * into found_one from public.product_legal l
   where l.id = p_entry and l.workspace_id = p_workspace and (p_product is null or l.product_id = p_product)
     and l.retired_at is null
   for update;
  if not found then
    raise exception 'Entry: no such Legal entry in this product, or it was retired.' using errcode = 'P0002', hint = 'entry';
  end if;
  return found_one;
end;
$$;

create function public.product_glossary_live(p_workspace uuid, p_product uuid, p_entry uuid) returns public.product_glossary
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_one public.product_glossary;
begin
  select * into found_one from public.product_glossary g
   where g.id = p_entry and g.workspace_id = p_workspace and (p_product is null or g.product_id = p_product)
     and g.removed_at is null
   for update;
  if not found then
    raise exception 'Entry: no such term in this product, or it was removed.' using errcode = 'P0002', hint = 'entry';
  end if;
  return found_one;
end;
$$;

-- Makes one change to a product's knowledge as the caller, with checked fields (product_knowledge_fields())
-- and no event: its caller logs it. Answers {entry, before, after, changed}: before null for an addition,
-- after null for a retirement or a removal, changed false (nothing written) for an edit that changes
-- nothing. The product's row is locked, so two additions never take one number or one term.
create function public.product_knowledge_apply(p_product public.products, p_kind text, p_action text, p_entry uuid, p_fields jsonb, p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  by_whom uuid := (select auth.uid());
  l public.product_legal;
  l2 public.product_legal;
  g public.product_glossary;
  g2 public.product_glossary;
  next_number integer;
begin
  perform 1 from public.products p where p.id = p_product.id for update;
  if p_kind = 'legal' and p_action = 'add' then
    select coalesce(max(x.number), 0) + 1 into next_number from public.product_legal x
     where x.product_id = p_product.id and x.code = p_fields->>'code';
    insert into public.product_legal (workspace_id, product_id, code, number, statement, source, owner_id, created_by)
    values (p_product.workspace_id, p_product.id, p_fields->>'code', next_number, p_fields->>'statement', p_fields->>'source',
            (p_fields->>'owner')::uuid, by_whom)
    returning * into l;
    return jsonb_build_object('entry', l.id, 'before', null, 'after', public.product_legal_fields(l), 'changed', true);
  elsif p_kind = 'legal' and p_action = 'edit' then
    l := public.product_legal_live(p_product.workspace_id, p_product.id, p_entry);
    l2 := l;
    l2.statement := coalesce(p_fields->>'statement', l.statement);
    l2.source := coalesce(p_fields->>'source', l.source);
    l2.owner_id := coalesce((p_fields->>'owner')::uuid, l.owner_id);
    if public.product_legal_fields(l2) = public.product_legal_fields(l) then
      return jsonb_build_object('entry', l.id, 'before', public.product_legal_fields(l), 'after', public.product_legal_fields(l), 'changed', false);
    end if;
    update public.product_legal x set statement = l2.statement, source = l2.source, owner_id = l2.owner_id, updated_at = now()
     where x.id = l.id returning * into l2;
    return jsonb_build_object('entry', l.id, 'before', public.product_legal_fields(l), 'after', public.product_legal_fields(l2), 'changed', true);
  elsif p_kind = 'legal' and p_action = 'retire' then
    l := public.product_legal_live(p_product.workspace_id, p_product.id, p_entry);
    update public.product_legal x set retired_at = now(), retired_by = by_whom, updated_at = now() where x.id = l.id;
    return jsonb_build_object('entry', l.id, 'before', public.product_legal_fields(l), 'after', null, 'changed', true);
  elsif p_kind = 'glossary' and p_action = 'add' then
    perform public.product_glossary_unique(p_product.id, p_fields->>'term', null);
    insert into public.product_glossary (workspace_id, product_id, term, meaning, avoid, created_by)
    values (p_product.workspace_id, p_product.id, p_fields->>'term', p_fields->>'meaning',
            array(select jsonb_array_elements_text(p_fields->'avoid')), by_whom)
    returning * into g;
    return jsonb_build_object('entry', g.id, 'before', null, 'after', public.product_glossary_fields(g), 'changed', true);
  elsif p_kind = 'glossary' and p_action = 'edit' then
    g := public.product_glossary_live(p_product.workspace_id, p_product.id, p_entry);
    g2 := g;
    g2.term := coalesce(p_fields->>'term', g.term);
    g2.meaning := coalesce(p_fields->>'meaning', g.meaning);
    if p_fields ? 'avoid' then
      g2.avoid := array(select jsonb_array_elements_text(p_fields->'avoid'));
    end if;
    if public.product_glossary_fields(g2) = public.product_glossary_fields(g) then
      return jsonb_build_object('entry', g.id, 'before', public.product_glossary_fields(g), 'after', public.product_glossary_fields(g), 'changed', false);
    end if;
    perform public.product_glossary_unique(p_product.id, g2.term, g.id);
    update public.product_glossary x set term = g2.term, meaning = g2.meaning, avoid = g2.avoid, updated_at = now()
     where x.id = g.id returning * into g2;
    return jsonb_build_object('entry', g.id, 'before', public.product_glossary_fields(g), 'after', public.product_glossary_fields(g2), 'changed', true);
  elsif p_kind = 'glossary' and p_action = 'remove' then
    g := public.product_glossary_live(p_product.workspace_id, p_product.id, p_entry);
    update public.product_glossary x set removed_at = now(), removed_by = by_whom, updated_at = now() where x.id = g.id;
    return jsonb_build_object('entry', g.id, 'before', public.product_glossary_fields(g), 'after', null, 'changed', true);
  end if;
  raise exception 'Action: add, edit or retire a Legal entry; add, edit or remove a term.' using errcode = '22023', hint = 'action';
end;
$$;

-- Appends one event, as the caller: a JSON null before or after is stored as none.
create function public.product_knowledge_log(p_product public.products, p_kind text, p_action text, p_entry uuid, p_proposal uuid, p_before jsonb, p_after jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_knowledge_events (workspace_id, product_id, kind, action, legal_id, glossary_id, proposal_id, before, after, changed_by)
  values (p_product.workspace_id, p_product.id, p_kind, p_action,
          case when p_kind = 'legal' then p_entry end, case when p_kind = 'glossary' then p_entry end,
          p_proposal, nullif(p_before, 'null'::jsonb), nullif(p_after, 'null'::jsonb), (select auth.uid()))
$$;

-- A direct change by the kind's decider: checks, applies and logs `p_event` when something changed.
create function public.product_knowledge_change(p_product public.products, p_kind text, p_action text, p_entry uuid, p_fields jsonb, p_event text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  made jsonb;
begin
  perform public.product_knowledge_decider_only(p_product.id, p_kind);
  made := public.product_knowledge_apply(p_product, p_kind, p_action, p_entry,
            public.product_knowledge_fields(p_product.workspace_id, p_kind, p_action, p_fields, (select auth.uid())), null);
  if (made->>'changed')::boolean then
    perform public.product_knowledge_log(p_product, p_kind, p_event, (made->>'entry')::uuid, null, made->'before', made->'after');
  end if;
  return (made->>'entry')::uuid;
end;
$$;

-- The product an entry of the workspace belongs to, after the member check, or P0002 naming `entry`.
create function public.product_knowledge_entry_product(p_workspace uuid, p_kind text, p_entry uuid) returns public.products
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
  return found_one;
end;
$$;

-- ── Who answers for it ───────────────────────────────────────────────────────────

-- A workspace owner names a kind's owner or delegate, changes them, or (p_user null) clears them. The
-- same person again changes nothing and logs nothing; anything else logs `named` with {role, user}
-- before and after. Answers {kind, role, user, login}.
create function public.product_knowledge_name(p_workspace uuid, p_product uuid, p_kind text, p_role text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  was public.product_knowledge_owners;
  had boolean;
begin
  if not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace names who answers for a product''s Legal entries and glossary.' using errcode = '42501';
  end if;
  perform public.product_knowledge_kind(p_kind);
  if p_role is null or p_role not in ('owner', 'delegate') then
    raise exception 'Role: owner or delegate.' using errcode = '22023', hint = 'role';
  end if;
  if p_user is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_user) then
    raise exception 'User: a member of the workspace.' using errcode = '22023', hint = 'user';
  end if;
  select * into was from public.product_knowledge_owners o
   where o.product_id = product.id and o.kind = p_kind and o.role = p_role
   for update;
  had := found;
  if had is distinct from (p_user is not null) or was.user_id is distinct from p_user then
    if p_user is null then
      delete from public.product_knowledge_owners o where o.product_id = product.id and o.kind = p_kind and o.role = p_role;
    else
      insert into public.product_knowledge_owners (workspace_id, product_id, kind, role, user_id, named_by)
      values (p_workspace, product.id, p_kind, p_role, p_user, (select auth.uid()))
      on conflict (product_id, kind, role) do update set user_id = excluded.user_id, named_by = excluded.named_by, named_at = now();
    end if;
    perform public.product_knowledge_log(product, p_kind, 'named', null, null,
      case when had then jsonb_build_object('role', p_role, 'user', was.user_id) end,
      case when p_user is not null then jsonb_build_object('role', p_role, 'user', p_user) end);
  end if;
  return jsonb_build_object('kind', p_kind, 'role', p_role, 'user', p_user,
                            'login', case when p_user is not null then public.member_login(p_workspace, p_user) end);
end;
$$;

-- ── Legal: the owner or delegate, directly ───────────────────────────────────────

-- Adds `L-<code>-<n>`, numbered after every entry of that code the product ever had; its owner is
-- `p_owner`, else the caller. Logs `added`.
create function public.product_legal_add(p_workspace uuid, p_product uuid, p_code text, p_statement text, p_source text, p_owner uuid default null)
returns public.product_legal
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  made uuid;
begin
  made := public.product_knowledge_change(product, 'legal', 'add', null,
            jsonb_strip_nulls(jsonb_build_object('code', coalesce(p_code, ''), 'statement', coalesce(p_statement, ''),
                                                 'source', coalesce(p_source, ''), 'owner', p_owner)), 'added');
  return (select l from public.product_legal l where l.id = made);
end;
$$;

-- Rewrites a live entry's statement, source or owner (a null keeps it); the code and number never
-- change. The same values change nothing and log nothing; anything else logs `edited`.
create function public.product_legal_edit(p_workspace uuid, p_entry uuid, p_statement text default null, p_source text default null, p_owner uuid default null)
returns public.product_legal
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_entry_product(p_workspace, 'legal', p_entry);
begin
  perform public.product_knowledge_change(product, 'legal', 'edit', p_entry,
            jsonb_strip_nulls(jsonb_build_object('statement', p_statement, 'source', p_source, 'owner', p_owner)), 'edited');
  return (select l from public.product_legal l where l.id = p_entry);
end;
$$;

-- Retires a live entry: it is kept, with its id, marked retired. Logs `retired`.
create function public.product_legal_retire(p_workspace uuid, p_entry uuid)
returns public.product_legal
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_entry_product(p_workspace, 'legal', p_entry);
begin
  perform public.product_knowledge_change(product, 'legal', 'retire', p_entry, '{}'::jsonb, 'retired');
  return (select l from public.product_legal l where l.id = p_entry);
end;
$$;

-- ── The glossary: the owner or delegate, directly ────────────────────────────────

-- Adds a term, unique among the product's live terms without case. Logs `added`.
create function public.product_glossary_add(p_workspace uuid, p_product uuid, p_term text, p_meaning text, p_avoid text[] default '{}')
returns public.product_glossary
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  made uuid;
begin
  made := public.product_knowledge_change(product, 'glossary', 'add', null,
            jsonb_build_object('term', coalesce(p_term, ''), 'meaning', coalesce(p_meaning, ''), 'avoid', to_jsonb(coalesce(p_avoid, '{}'::text[]))),
            'added');
  return (select g from public.product_glossary g where g.id = made);
end;
$$;

-- Rewrites a live term's spelling, meaning or words to avoid (a null keeps it). The same values change
-- nothing and log nothing; anything else logs `edited`.
create function public.product_glossary_edit(p_workspace uuid, p_entry uuid, p_term text default null, p_meaning text default null, p_avoid text[] default null)
returns public.product_glossary
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_entry_product(p_workspace, 'glossary', p_entry);
begin
  perform public.product_knowledge_change(product, 'glossary', 'edit', p_entry,
            jsonb_strip_nulls(jsonb_build_object('term', p_term, 'meaning', p_meaning, 'avoid', to_jsonb(p_avoid))), 'edited');
  return (select g from public.product_glossary g where g.id = p_entry);
end;
$$;

-- Removes a live term: it is kept, marked removed, and the same word may be added again. Logs `removed`.
create function public.product_glossary_remove(p_workspace uuid, p_entry uuid)
returns public.product_glossary
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_entry_product(p_workspace, 'glossary', p_entry);
begin
  perform public.product_knowledge_change(product, 'glossary', 'remove', p_entry, '{}'::jsonb, 'removed');
  return (select g from public.product_glossary g where g.id = p_entry);
end;
$$;

-- ── Proposals: any member proposes, the kind's decider approves or rejects ───────

-- Any member proposes adding, editing or retiring a Legal entry, or adding, editing or removing a term,
-- with the fields product_knowledge_fields() takes (a proposed entry's owner defaults to the proposer).
-- An edit, retirement or removal names a live entry of the product; an addition names none. Logs
-- `proposed`, with the entry's fields before and the proposed ones after. Nothing else changes.
create function public.product_knowledge_propose(p_workspace uuid, p_product uuid, p_kind text, p_action text, p_entry uuid default null, p_fields jsonb default '{}'::jsonb)
returns public.product_knowledge_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  f jsonb;
  before_fields jsonb;
  made public.product_knowledge_proposals;
begin
  perform public.product_knowledge_kind(p_kind);
  f := public.product_knowledge_fields(p_workspace, p_kind, p_action, p_fields, (select auth.uid()));
  if p_action = 'add' then
    if p_entry is not null then
      raise exception 'Entry: an addition names no entry.' using errcode = '22023', hint = 'entry';
    end if;
    if p_kind = 'glossary' then
      perform public.product_glossary_unique(product.id, f->>'term', null);
    end if;
  elsif p_kind = 'legal' then
    before_fields := public.product_legal_fields(public.product_legal_live(p_workspace, product.id, p_entry));
  else
    before_fields := public.product_glossary_fields(public.product_glossary_live(p_workspace, product.id, p_entry));
    if f ? 'term' then
      perform public.product_glossary_unique(product.id, f->>'term', p_entry);
    end if;
  end if;
  insert into public.product_knowledge_proposals (workspace_id, product_id, kind, action, legal_id, glossary_id, fields, proposed_by)
  values (p_workspace, product.id, p_kind, p_action,
          case when p_kind = 'legal' then p_entry end, case when p_kind = 'glossary' then p_entry end,
          f, (select auth.uid()))
  returning * into made;
  perform public.product_knowledge_log(product, p_kind, 'proposed', p_entry, made.id, before_fields, f);
  return made;
end;
$$;

-- An open proposal of the workspace, locked for the decision, after the member check and the decider's;
-- P0002 naming `proposal` when there is no such open proposal.
create function public.product_knowledge_open(p_workspace uuid, p_proposal uuid) returns public.product_knowledge_proposals
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
  perform public.product_knowledge_decider_only(found_one.product_id, found_one.kind);
  return found_one;
end;
$$;

-- The kind's decider approves an open proposal: the change is made as proposed (the fields checked
-- again), the proposal records who approved it and when, and one `approved` event carries the change.
create function public.product_knowledge_approve(p_workspace uuid, p_proposal uuid)
returns public.product_knowledge_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.product_knowledge_proposals := public.product_knowledge_open(p_workspace, p_proposal);
  product public.products;
  made jsonb;
  entry uuid;
  decided public.product_knowledge_proposals;
begin
  select p.* into product from public.products p where p.id = was.product_id;
  made := public.product_knowledge_apply(product, was.kind, was.action, coalesce(was.legal_id, was.glossary_id),
            public.product_knowledge_fields(p_workspace, was.kind, was.action, was.fields, was.proposed_by), null);
  entry := (made->>'entry')::uuid;
  update public.product_knowledge_proposals x
     set state = 'approved', decided_by = (select auth.uid()), decided_at = now(),
         legal_id = case when x.kind = 'legal' then entry end, glossary_id = case when x.kind = 'glossary' then entry end
   where x.id = was.id
  returning * into decided;
  perform public.product_knowledge_log(product, was.kind, 'approved', entry, was.id, made->'before', made->'after');
  return decided;
end;
$$;

-- The kind's decider rejects an open proposal: it is kept, with who rejected it and when, nothing else
-- changes, and one `rejected` event records the decision.
create function public.product_knowledge_reject(p_workspace uuid, p_proposal uuid)
returns public.product_knowledge_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.product_knowledge_proposals := public.product_knowledge_open(p_workspace, p_proposal);
  product public.products;
  decided public.product_knowledge_proposals;
begin
  select p.* into product from public.products p where p.id = was.product_id;
  update public.product_knowledge_proposals x set state = 'rejected', decided_by = (select auth.uid()), decided_at = now()
   where x.id = was.id
  returning * into decided;
  perform public.product_knowledge_log(product, was.kind, 'rejected', coalesce(was.legal_id, was.glossary_id), was.id, null, null);
  return decided;
end;
$$;

-- ── The reads ────────────────────────────────────────────────────────────────────

-- A member as the page shows them: {user, login}, or null.
create function public.product_knowledge_person(p_workspace uuid, p_user uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select case when p_user is not null then jsonb_build_object('user', p_user, 'login', public.member_login(p_workspace, p_user)) end
$$;

-- What the Knowledge tab of a product shows a member (42501 anyone else, P0002 another workspace's
-- product): `{product: {id, name}, canName, latestEventId, legal, glossary}`, where `canName` says the
-- reader may name owners and delegates, `latestEventId` is the product's newest event as text (or null),
-- and each kind is `{owner, delegate, decides, entries, proposals}`: owner and delegate `{user, login}`
-- or null (a named person who left the workspace is null), `decides` whether the reader adds, edits and
-- decides directly, `entries` every entry, retired and removed ones too (Legal: `{entry, id, code,
-- number, statement, source, owner, retiredAt}`, by code then number; glossary: `{entry, term, meaning,
-- avoid, removedAt}`, by term without case, the live one first), `proposals` the open ones, oldest first
-- (`{proposal, action, entry, fields, proposedBy, proposedAt}`).
create function public.product_knowledge_of(p_workspace uuid, p_product uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  k text;
  sections jsonb := '{}'::jsonb;
begin
  foreach k in array array['legal', 'glossary'] loop
    sections := sections || jsonb_build_object(k, jsonb_build_object(
      'owner', public.product_knowledge_person(p_workspace,
                 (select n.user_id from public.product_knowledge_named(product.id, k) n where n.role = 'owner')),
      'delegate', public.product_knowledge_person(p_workspace,
                 (select n.user_id from public.product_knowledge_named(product.id, k) n where n.role = 'delegate')),
      'decides', public.product_knowledge_decides(product.id, k),
      'entries', case when k = 'legal' then
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'entry', l.id, 'id', 'L-' || l.code || '-' || l.number, 'code', l.code, 'number', l.number,
                  'statement', l.statement, 'source', l.source,
                  'owner', public.product_knowledge_person(p_workspace, l.owner_id), 'retiredAt', l.retired_at)
                order by l.code collate "C", l.number), '[]'::jsonb)
           from public.product_legal l where l.product_id = product.id)
      else
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'entry', g.id, 'term', g.term, 'meaning', g.meaning, 'avoid', to_jsonb(g.avoid), 'removedAt', g.removed_at)
                order by lower(g.term), g.removed_at nulls first, g.id), '[]'::jsonb)
           from public.product_glossary g where g.product_id = product.id)
      end,
      'proposals',
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'proposal', x.id, 'action', x.action, 'entry', coalesce(x.legal_id, x.glossary_id), 'fields', x.fields,
                  'proposedBy', public.product_knowledge_person(p_workspace, x.proposed_by), 'proposedAt', x.proposed_at)
                order by x.proposed_at, x.id), '[]'::jsonb)
           from public.product_knowledge_proposals x where x.product_id = product.id and x.kind = k and x.state = 'open')));
  end loop;
  return jsonb_build_object(
    'product', jsonb_build_object('id', product.id, 'name', product.name),
    'canName', public.is_owner(p_workspace),
    'latestEventId', (select max(e.id)::text from public.product_knowledge_events e where e.product_id = product.id))
    || sections;
end;
$$;

-- What agents read of a product's knowledge: `{legal, glossary}`. legal: its active entries
-- `{id: "L-<CODE>-<n>", statement, source, owner}`, the owner's login, by code then number; glossary:
-- its live terms `{term, meaning, avoid}`, by term without case. `[]` each with none or no product.
-- Internal: callers check who asks.
create function public.product_knowledge_for_agents(p_product uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'legal', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', 'L-' || l.code || '-' || l.number, 'statement', l.statement, 'source', l.source,
                       'owner', case when l.owner_id is not null then public.member_login(l.workspace_id, l.owner_id) end)
                     order by l.code collate "C", l.number), '[]'::jsonb)
                from public.product_legal l where l.product_id = p_product and l.retired_at is null),
    'glossary', (select coalesce(jsonb_agg(jsonb_build_object('term', g.term, 'meaning', g.meaning, 'avoid', to_jsonb(g.avoid))
                        order by lower(g.term), g.term), '[]'::jsonb)
                   from public.product_glossary g where g.product_id = p_product and g.removed_at is null))
$$;

-- As 20261028090000_agent_tokens.sql, with `legal` and `glossary` (PRD 1795): what business_for_repo()
-- answers a terminal and business_for_token() an agent's link. `state` still comes from claims only.
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
    'personas', cast_of)
    || public.product_knowledge_for_agents(product.id);
end;
$$;

-- As 20261129110000_product_lookups.sql, with `legal`, `glossary` and `knowledgeEventId` (PRD 1795): the
-- canon gate reads the product's Legal entries beside its claims, and keys its verdict by the newest
-- knowledge event.
create or replace function public.business_for_repo_app(p_repo text) returns jsonb
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
                                               'claims', '[]'::jsonb, 'personas', '[]'::jsonb, 'updatedAt', null,
                                               'legal', '[]'::jsonb, 'glossary', '[]'::jsonb, 'knowledgeEventId', null);
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
  select p.* into product from public.products p where p.id = public.repository_only_product(ws, v_repo);
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
    'updatedAt', changed,
    'knowledgeEventId', (select max(e.id)::text from public.product_knowledge_events e where e.product_id = product.id))
    || public.product_knowledge_for_agents(product.id);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.product_knowledge_owners enable row level security;
alter table public.product_legal enable row level security;
alter table public.product_glossary enable row level security;
alter table public.product_knowledge_proposals enable row level security;
alter table public.product_knowledge_events enable row level security;

-- Membership is read once per statement (bug #1832): my_workspaces(), never is_member() of the row.
create policy "a member reads who answers for their workspace's products" on public.product_knowledge_owners
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's Legal entries" on public.product_legal
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's glossary" on public.product_glossary
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's knowledge proposals" on public.product_knowledge_proposals
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's knowledge history" on public.product_knowledge_events
  for select to authenticated using (workspace_id in (select public.my_workspaces()));

-- Signed out: nothing. Signed in: reads only, the rows above. Nobody, the service role included, writes
-- any of the five tables directly, and nobody updates or deletes an event.
revoke all on public.product_knowledge_owners, public.product_legal, public.product_glossary,
              public.product_knowledge_proposals, public.product_knowledge_events
  from public, anon, authenticated, service_role;
grant select on public.product_knowledge_owners, public.product_legal, public.product_glossary,
                public.product_knowledge_proposals, public.product_knowledge_events
  to authenticated, service_role;

revoke execute on function public.product_knowledge_member_only(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_product(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_kind(text) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_text(text, text, text, integer) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_named(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_decides(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_decider_only(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_fields(uuid, text, text, jsonb, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_legal_fields(public.product_legal) from public, anon, authenticated, service_role;
revoke execute on function public.product_glossary_fields(public.product_glossary) from public, anon, authenticated, service_role;
revoke execute on function public.product_glossary_unique(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_legal_live(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_glossary_live(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_apply(public.products, text, text, uuid, jsonb, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_log(public.products, text, text, uuid, uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_change(public.products, text, text, uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_entry_product(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_open(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_person(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_knowledge_for_agents(uuid) from public, anon, authenticated, service_role;

revoke execute on function public.product_knowledge_name(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.product_knowledge_name(uuid, uuid, text, text, uuid) to authenticated;
revoke execute on function public.product_legal_add(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.product_legal_add(uuid, uuid, text, text, text, uuid) to authenticated;
revoke execute on function public.product_legal_edit(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.product_legal_edit(uuid, uuid, text, text, uuid) to authenticated;
revoke execute on function public.product_legal_retire(uuid, uuid) from public, anon;
grant execute on function public.product_legal_retire(uuid, uuid) to authenticated;
revoke execute on function public.product_glossary_add(uuid, uuid, text, text, text[]) from public, anon;
grant execute on function public.product_glossary_add(uuid, uuid, text, text, text[]) to authenticated;
revoke execute on function public.product_glossary_edit(uuid, uuid, text, text, text[]) from public, anon;
grant execute on function public.product_glossary_edit(uuid, uuid, text, text, text[]) to authenticated;
revoke execute on function public.product_glossary_remove(uuid, uuid) from public, anon;
grant execute on function public.product_glossary_remove(uuid, uuid) to authenticated;
revoke execute on function public.product_knowledge_propose(uuid, uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.product_knowledge_propose(uuid, uuid, text, text, uuid, jsonb) to authenticated;
revoke execute on function public.product_knowledge_approve(uuid, uuid) from public, anon;
grant execute on function public.product_knowledge_approve(uuid, uuid) to authenticated;
revoke execute on function public.product_knowledge_reject(uuid, uuid) from public, anon;
grant execute on function public.product_knowledge_reject(uuid, uuid) to authenticated;
revoke execute on function public.product_knowledge_of(uuid, uuid) from public, anon;
grant execute on function public.product_knowledge_of(uuid, uuid) to authenticated;
