-- A product's governed list of domains (PRD 2583 s1, docs:
-- .omni-loop/delivery/inbox/2583-product-domains/spec.md). A third kind of a product's knowledge, beside
-- its Legal entries and its glossary (20261212110000_product_knowledge.sql), written the same way: every
-- member of the workspace reads, nobody signed in writes a table directly, and every change goes through
-- a definer function that checks the caller's role and appends its event in the same transaction.
--
--   product_domains               a domain: its key (lower-case words joined by hyphens, at most 60
--                                 characters, the same word as its folder under `domains/`), its name
--                                 (1 to 80 characters) and its meaning (1 to 400). The key never changes
--                                 and is never reused in its product, even once the domain is retired;
--                                 retired, never deleted
--
-- The kind `domains` joins `legal` and `glossary` everywhere a kind is named:
-- - product_knowledge_owners: the Domains kind has its own owner and delegate, named by a workspace
--   owner; while it names neither, the workspace's owners decide.
-- - product_knowledge_proposals: any other member proposes adding, editing or retiring a domain
--   (`domain_id` names the domain an edit or a retirement is for, and an approved addition's new one).
-- - product_knowledge_events: one row per change, `domain_id` naming the domain.
--
--   product_domain_add(workspace, product, key, name, meaning)   the Domains owner or delegate, directly
--   product_domain_edit(workspace, entry, name, meaning)          a null keeps the field; the key never changes
--   product_domain_retire(workspace, entry)                       kept, marked retired
--   product_knowledge_propose / _approve / _reject / _name        take the kind `domains`
--   product_knowledge_of(workspace, product)                      gains `domains`, as `legal` and `glossary`:
--     {owner, delegate, decides, entries, proposals}, each entry {entry, key, name, meaning, retiredAt,
--     createdBy, createdAt, updatedAt}, by key
--
--   product_glossary_domains      (s2) the domains a term names, none, one or several, of its own product
--   a term's `domains`            a list of keys on a glossary add or edit (and its proposal), `[]` clears the
--                                 active ones; a retired domain is never linked anew, an old link stays
--   product_knowledge_for_agents  (s2) answers `domains` {key, name, meaning} and each term's `domains`,
--                                 which business_for_product() and business_for_repo_app() carry
--
-- Refusals as the other kinds': 42501 not allowed (not a member, or may only propose), P0002 no such
-- product, domain or open proposal (or an archived product), 22023 a bad value with the field in `hint`:
-- `key` for an invalid key, one the product has, or one it retired.
--
-- Nothing is seeded: a product's list starts empty. Proven by supabase/checks/product_domains.sql, the
-- widened kinds by supabase/checks/product_knowledge.sql.
--
-- Rollback: a follow-up migration restores product_knowledge_kind(), product_knowledge_decider_only(),
-- product_knowledge_fields(), product_knowledge_apply(), product_knowledge_log(), product_knowledge_propose(),
-- product_knowledge_approve() and product_knowledge_reject() from 20261212110000_product_knowledge.sql,
-- product_knowledge_entry_product() from 20261217100000_archive_product.sql and product_knowledge_of() from
-- 20261218090000_product_knowledge_authors.sql; deletes the owners, proposals and events of the kind
-- `domains`; drops the two `domain_id` columns, restores the three tables' checks as they were; then drops
-- product_domain_add(), _edit(), _retire(), _fields(), _live(), _unique() and the table. The s2 part:
-- drop product_glossary_domains and its helpers (product_glossary_domain_keys(), _domains_object(),
-- _domain_check(), _domain_link()), restore product_glossary_add() and product_glossary_edit() without
-- `p_domains` and product_knowledge_for_agents() from 20261212110000_product_knowledge.sql, then drop the
-- unique constraint product_glossary_id_product_key.

-- ── The table ────────────────────────────────────────────────────────────────────

create table public.product_domains (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  key          text not null check (key ~ '^[a-z][a-z0-9-]*$' and char_length(key) <= 60),
  name         text not null check (char_length(name) between 1 and 80),
  meaning      text not null check (char_length(meaning) between 1 and 400),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  retired_at   timestamptz,
  retired_by   uuid references auth.users on delete set null,
  -- A key is the product's for good: a retired domain keeps it.
  unique (product_id, key),
  -- What product_glossary_domains points at, so a term never names another product's domain.
  unique (id, product_id)
);

create index product_domains_workspace_idx on public.product_domains (workspace_id);

comment on table public.product_domains is
  'A product''s domains (PRD 2583): a key, the same word as its folder under domains/, a name and a meaning. The key never changes and is never reused in its product, even once retired. Written only by product_domain_add/edit/retire() and an approved proposal; retiring sets retired_at and keeps the row.';

-- ── A term's domains (PRD 2583 s2) ───────────────────────────────────────────────

alter table public.product_glossary add constraint product_glossary_id_product_key unique (id, product_id);

-- A term names zero, one or several domains of its own product. Both foreign keys carry the product, so a
-- link to another product's domain cannot exist. A link made before its domain was retired stays.
create table public.product_glossary_domains (
  glossary_id  uuid not null,
  domain_id    uuid not null,
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  linked_by    uuid references auth.users on delete set null,
  linked_at    timestamptz not null default now(),
  primary key (glossary_id, domain_id),
  foreign key (glossary_id, product_id) references public.product_glossary (id, product_id) on delete cascade,
  foreign key (domain_id, product_id) references public.product_domains (id, product_id) on delete cascade
);

create index product_glossary_domains_domain_idx on public.product_glossary_domains (domain_id);
create index product_glossary_domains_workspace_idx on public.product_glossary_domains (workspace_id);

comment on table public.product_glossary_domains is
  'The domains a glossary term names (PRD 2583 s2), none meaning a cross-domain term. Written only by product_knowledge_apply(), as the term is added or edited; a link to a retired domain is never made, and one made before its retirement stays.';

-- ── The kinds: `domains` beside `legal` and `glossary` ───────────────────────────

alter table public.product_knowledge_owners
  drop constraint product_knowledge_owners_kind_check,
  add constraint product_knowledge_owners_kind_check check (kind in ('legal', 'glossary', 'domains'));

alter table public.product_knowledge_proposals
  add column domain_id uuid references public.product_domains on delete cascade,
  drop constraint product_knowledge_proposals_kind_check,
  add constraint product_knowledge_proposals_kind_check check (kind in ('legal', 'glossary', 'domains')),
  drop constraint product_knowledge_proposals_check,
  add constraint product_knowledge_proposals_check
    check ((kind in ('legal', 'domains') and action in ('add', 'edit', 'retire')) or (kind = 'glossary' and action in ('add', 'edit', 'remove'))),
  drop constraint product_knowledge_proposals_check3,
  add constraint product_knowledge_proposals_check3 check (action = 'add' or num_nonnulls(legal_id, glossary_id, domain_id) = 1),
  add constraint product_knowledge_proposals_domain_check check (kind = 'domains' or domain_id is null);

alter table public.product_knowledge_events
  add column domain_id uuid references public.product_domains on delete cascade,
  drop constraint product_knowledge_events_kind_check,
  add constraint product_knowledge_events_kind_check check (kind in ('legal', 'glossary', 'domains')),
  drop constraint product_knowledge_events_check,
  add constraint product_knowledge_events_check check (num_nonnulls(legal_id, glossary_id, domain_id) <= 1);

comment on column public.product_knowledge_proposals.domain_id is
  'PRD 2583: the domain an edit or a retirement is for; an approved addition''s new domain.';
comment on column public.product_knowledge_events.domain_id is
  'PRD 2583: the domain the change is to.';

-- ── Helpers ──────────────────────────────────────────────────────────────────────

-- As 20261212110000_product_knowledge.sql, with `domains`.
create or replace function public.product_knowledge_kind(p_kind text) returns text
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('legal', 'glossary', 'domains') then
    raise exception 'Kind: legal, glossary or domains.' using errcode = '22023', hint = 'kind';
  end if;
  return p_kind;
end;
$$;

-- As 20261212110000_product_knowledge.sql, saying who decides the domains.
create or replace function public.product_knowledge_decider_only(p_product uuid, p_kind text) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if not public.product_knowledge_decides(p_product, p_kind) then
    if p_kind = 'legal' then
      raise exception 'Only the Legal owner or delegate changes Legal entries: propose the change instead.' using errcode = '42501';
    end if;
    if p_kind = 'domains' then
      raise exception 'Only the Domains owner or delegate changes the domains: propose the change instead.' using errcode = '42501';
    end if;
    raise exception 'Only the Glossary owner or delegate changes the glossary: propose the change instead.' using errcode = '42501';
  end if;
end;
$$;

-- As 20261212110000_product_knowledge.sql, with the fields of a domain:
--   domains add    {key, name, meaning}
--   domains edit   any of {name, meaning}, at least one; the key never changes
--   domains retire nothing
-- key: lower-case letters, digits and hyphens, starting with a letter, at most 60 (trimmed, never
-- re-cased: it is the folder's own word); name: 1 to 80 characters on one line; meaning: 1 to 400.
create or replace function public.product_knowledge_fields(p_workspace uuid, p_kind text, p_action text, p_fields jsonb, p_owner uuid)
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
  if p_action is null or (p_kind in ('legal', 'domains') and p_action not in ('add', 'edit', 'retire'))
     or (p_kind = 'glossary' and p_action not in ('add', 'edit', 'remove')) then
    raise exception 'Action: add, edit or retire a Legal entry or a domain; add, edit or remove a term.' using errcode = '22023', hint = 'action';
  end if;
  allowed := case
    when p_action in ('retire', 'remove') then '{}'::text[]
    when p_kind = 'legal' and adding then array['code', 'statement', 'source', 'owner']
    when p_kind = 'legal' then array['statement', 'source', 'owner']
    when p_kind = 'domains' and adding then array['key', 'name', 'meaning']
    when p_kind = 'domains' then array['name', 'meaning']
    else array['term', 'meaning', 'avoid', 'domains'] end;
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
  elsif p_kind = 'domains' then
    if adding then
      v := btrim(coalesce(case when jsonb_typeof(f->'key') = 'string' then f->>'key' end, ''));
      if v !~ '^[a-z][a-z0-9-]*$' or char_length(v) > 60 then
        raise exception 'Key: lower-case letters, digits and hyphens, starting with a letter, at most 60 (invoicing).' using errcode = '22023', hint = 'key';
      end if;
      out := out || jsonb_build_object('key', v);
    end if;
    if adding or f ? 'name' then
      out := out || jsonb_build_object('name', public.product_knowledge_text(f->>'name', 'name', 'Name', 80));
    end if;
    if adding or f ? 'meaning' then
      out := out || jsonb_build_object('meaning', public.product_knowledge_text(f->>'meaning', 'meaning', 'Meaning', 400));
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
    -- A term's domains: keys, trimmed, once each; `[]` or null names none. Whether each is the product's, and
    -- live, is product_glossary_domain_check()'s.
    if f ? 'domains' then
      if jsonb_typeof(f->'domains') not in ('array', 'null') or jsonb_array_length(case when jsonb_typeof(f->'domains') = 'array' then f->'domains' else '[]'::jsonb end) > 20 then
        raise exception 'Domains: at most 20 domain keys.' using errcode = '22023', hint = 'domains';
      end if;
      words := '{}';
      for word in select * from jsonb_array_elements(case when jsonb_typeof(f->'domains') = 'array' then f->'domains' else '[]'::jsonb end) loop
        v := btrim(coalesce(case when jsonb_typeof(word) = 'string' then word #>> '{}' end, ''));
        if v !~ '^[a-z][a-z0-9-]*$' or char_length(v) > 60 then
          raise exception 'Domains: each a domain key (lower-case letters, digits and hyphens).' using errcode = '22023', hint = 'domains';
        end if;
        if not v = any (words) then
          words := words || v;
        end if;
      end loop;
      out := out || jsonb_build_object('domains', to_jsonb(words));
    end if;
  end if;
  return out;
end;
$$;

-- A domain's fields, as events and proposals record them.
create function public.product_domain_fields(e public.product_domains) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('key', e.key, 'name', e.name, 'meaning', e.meaning)
$$;

-- 22023 naming `key` when the product has, or had, a domain of that key: a key is never reused.
create function public.product_domain_unique(p_product uuid, p_key text) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  was timestamptz;
begin
  select d.retired_at into was from public.product_domains d where d.product_id = p_product and d.key = p_key;
  if not found then
    return;
  end if;
  if was is not null then
    raise exception 'Key: % was a domain of this product, retired, and a key is never reused.', p_key using errcode = '22023', hint = 'key';
  end if;
  raise exception 'Key: the product has the domain % already.', p_key using errcode = '22023', hint = 'key';
end;
$$;

-- A live domain of the product, locked for the write (by id, of the workspace when `p_product` is null),
-- or P0002 naming `entry`.
create function public.product_domain_live(p_workspace uuid, p_product uuid, p_entry uuid) returns public.product_domains
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_one public.product_domains;
begin
  select * into found_one from public.product_domains d
   where d.id = p_entry and d.workspace_id = p_workspace and (p_product is null or d.product_id = p_product)
     and d.retired_at is null
   for update;
  if not found then
    raise exception 'Entry: no such domain in this product, or it was retired.' using errcode = 'P0002', hint = 'entry';
  end if;
  return found_one;
end;
$$;

-- The keys of the domains a term names, retired ones too, by key: a jsonb array.
create function public.product_glossary_domain_keys(p_glossary uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(dm.key order by dm.key collate "C"), '[]'::jsonb)
    from public.product_glossary_domains lk join public.product_domains dm on dm.id = lk.domain_id
   where lk.glossary_id = p_glossary
$$;

-- What a term's domains add to its fields in an event or a proposal: `{domains: [...]}`, nothing for none,
-- so a term with no domain records what it always did.
create function public.product_glossary_domains_object(p_keys jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  select case when jsonb_array_length(coalesce(p_keys, '[]'::jsonb)) = 0 then '{}'::jsonb else jsonb_build_object('domains', p_keys) end
$$;

-- 22023 naming `domains` when a key is no domain of the product, or a retired one the term (`p_glossary`,
-- null for an addition) is not already linked to: a new link to a retired domain is refused, an old one stays.
create function public.product_glossary_domain_check(p_product uuid, p_glossary uuid, p_keys jsonb) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  wanted text;
  dom public.product_domains;
begin
  for wanted in select jsonb_array_elements_text(coalesce(p_keys, '[]'::jsonb)) loop
    select * into dom from public.product_domains dm where dm.product_id = p_product and dm.key = wanted;
    if not found then
      raise exception 'Domains: this product has no domain %.', wanted using errcode = '22023', hint = 'domains';
    end if;
    if dom.retired_at is not null and not exists (
         select 1 from public.product_glossary_domains lk where lk.glossary_id = p_glossary and lk.domain_id = dom.id) then
      raise exception 'Domains: % is retired: a term cannot be linked to it anew.', wanted using errcode = '22023', hint = 'domains';
    end if;
  end loop;
end;
$$;

-- Links the term to the domains of `p_keys`, those it has already kept.
create function public.product_glossary_domain_link(p_product uuid, p_glossary uuid, p_keys jsonb) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_glossary_domains (glossary_id, domain_id, workspace_id, product_id, linked_by)
  select p_glossary, dm.id, dm.workspace_id, dm.product_id, (select auth.uid())
    from public.product_domains dm
   where dm.product_id = p_product and dm.key in (select jsonb_array_elements_text(p_keys))
  on conflict do nothing
$$;

-- As 20261212110000_product_knowledge.sql, with a domain added, edited or retired, and a term's domains.
create or replace function public.product_knowledge_apply(p_product public.products, p_kind text, p_action text, p_entry uuid, p_fields jsonb, p_owner uuid)
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
  d public.product_domains;
  d2 public.product_domains;
  was_keys jsonb;
  kept_keys jsonb;
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
    perform public.product_glossary_domain_check(p_product.id, null, p_fields->'domains');
    insert into public.product_glossary (workspace_id, product_id, term, meaning, avoid, created_by)
    values (p_product.workspace_id, p_product.id, p_fields->>'term', p_fields->>'meaning',
            array(select jsonb_array_elements_text(p_fields->'avoid')), by_whom)
    returning * into g;
    perform public.product_glossary_domain_link(p_product.id, g.id, p_fields->'domains');
    return jsonb_build_object('entry', g.id, 'before', null,
             'after', public.product_glossary_fields(g) || public.product_glossary_domains_object(public.product_glossary_domain_keys(g.id)), 'changed', true);
  elsif p_kind = 'glossary' and p_action = 'edit' then
    g := public.product_glossary_live(p_product.workspace_id, p_product.id, p_entry);
    g2 := g;
    g2.term := coalesce(p_fields->>'term', g.term);
    g2.meaning := coalesce(p_fields->>'meaning', g.meaning);
    if p_fields ? 'avoid' then
      g2.avoid := array(select jsonb_array_elements_text(p_fields->'avoid'));
    end if;
    -- The domains named replace the term's live ones; the retired ones it already names stay.
    was_keys := public.product_glossary_domain_keys(g.id);
    kept_keys := was_keys;
    if p_fields ? 'domains' then
      perform public.product_glossary_domain_check(p_product.id, g.id, p_fields->'domains');
      select coalesce(jsonb_agg(x.k order by x.k collate "C"), '[]'::jsonb) into kept_keys from (
        select w.k from jsonb_array_elements_text(p_fields->'domains') w(k)
        union
        select dm.key from public.product_glossary_domains lk join public.product_domains dm on dm.id = lk.domain_id
         where lk.glossary_id = g.id and dm.retired_at is not null) x(k);
    end if;
    if public.product_glossary_fields(g2) || public.product_glossary_domains_object(kept_keys)
       = public.product_glossary_fields(g) || public.product_glossary_domains_object(was_keys) then
      return jsonb_build_object('entry', g.id, 'before', public.product_glossary_fields(g) || public.product_glossary_domains_object(was_keys),
               'after', public.product_glossary_fields(g) || public.product_glossary_domains_object(was_keys), 'changed', false);
    end if;
    perform public.product_glossary_unique(p_product.id, g2.term, g.id);
    update public.product_glossary x set term = g2.term, meaning = g2.meaning, avoid = g2.avoid, updated_at = now()
     where x.id = g.id returning * into g2;
    if kept_keys <> was_keys then
      delete from public.product_glossary_domains lk using public.product_domains dm
       where lk.glossary_id = g.id and dm.id = lk.domain_id and dm.retired_at is null
         and dm.key not in (select jsonb_array_elements_text(kept_keys));
      perform public.product_glossary_domain_link(p_product.id, g.id, kept_keys);
    end if;
    return jsonb_build_object('entry', g.id, 'before', public.product_glossary_fields(g) || public.product_glossary_domains_object(was_keys),
             'after', public.product_glossary_fields(g2) || public.product_glossary_domains_object(kept_keys), 'changed', true);
  elsif p_kind = 'glossary' and p_action = 'remove' then
    g := public.product_glossary_live(p_product.workspace_id, p_product.id, p_entry);
    update public.product_glossary x set removed_at = now(), removed_by = by_whom, updated_at = now() where x.id = g.id;
    return jsonb_build_object('entry', g.id, 'before', public.product_glossary_fields(g), 'after', null, 'changed', true);
  elsif p_kind = 'domains' and p_action = 'add' then
    perform public.product_domain_unique(p_product.id, p_fields->>'key');
    insert into public.product_domains (workspace_id, product_id, key, name, meaning, created_by)
    values (p_product.workspace_id, p_product.id, p_fields->>'key', p_fields->>'name', p_fields->>'meaning', by_whom)
    returning * into d;
    return jsonb_build_object('entry', d.id, 'before', null, 'after', public.product_domain_fields(d), 'changed', true);
  elsif p_kind = 'domains' and p_action = 'edit' then
    d := public.product_domain_live(p_product.workspace_id, p_product.id, p_entry);
    d2 := d;
    d2.name := coalesce(p_fields->>'name', d.name);
    d2.meaning := coalesce(p_fields->>'meaning', d.meaning);
    if public.product_domain_fields(d2) = public.product_domain_fields(d) then
      return jsonb_build_object('entry', d.id, 'before', public.product_domain_fields(d), 'after', public.product_domain_fields(d), 'changed', false);
    end if;
    update public.product_domains x set name = d2.name, meaning = d2.meaning, updated_at = now()
     where x.id = d.id returning * into d2;
    return jsonb_build_object('entry', d.id, 'before', public.product_domain_fields(d), 'after', public.product_domain_fields(d2), 'changed', true);
  elsif p_kind = 'domains' and p_action = 'retire' then
    d := public.product_domain_live(p_product.workspace_id, p_product.id, p_entry);
    update public.product_domains x set retired_at = now(), retired_by = by_whom, updated_at = now() where x.id = d.id;
    return jsonb_build_object('entry', d.id, 'before', public.product_domain_fields(d), 'after', null, 'changed', true);
  end if;
  raise exception 'Action: add, edit or retire a Legal entry or a domain; add, edit or remove a term.' using errcode = '22023', hint = 'action';
end;
$$;

-- As 20261212110000_product_knowledge.sql, a domain's events naming it.
create or replace function public.product_knowledge_log(p_product public.products, p_kind text, p_action text, p_entry uuid, p_proposal uuid, p_before jsonb, p_after jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_knowledge_events (workspace_id, product_id, kind, action, legal_id, glossary_id, domain_id, proposal_id, before, after, changed_by)
  values (p_product.workspace_id, p_product.id, p_kind, p_action,
          case when p_kind = 'legal' then p_entry end, case when p_kind = 'glossary' then p_entry end,
          case when p_kind = 'domains' then p_entry end,
          p_proposal, nullif(p_before, 'null'::jsonb), nullif(p_after, 'null'::jsonb), (select auth.uid()))
$$;

-- As 20261217100000_archive_product.sql, finding a domain's product too.
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
   where p.id = case p_kind
                  when 'legal' then (select l.product_id from public.product_legal l where l.id = p_entry and l.workspace_id = p_workspace)
                  when 'domains' then (select d.product_id from public.product_domains d where d.id = p_entry and d.workspace_id = p_workspace)
                  else (select g.product_id from public.product_glossary g where g.id = p_entry and g.workspace_id = p_workspace) end;
  if not found then
    raise exception 'Entry: no such entry in this workspace.' using errcode = 'P0002', hint = 'entry';
  end if;
  return public.product_live(found_one);
end;
$$;

-- ── Domains: the owner or delegate, directly ─────────────────────────────────────

-- Adds a domain whose key the product never had. Logs `added`.
create function public.product_domain_add(p_workspace uuid, p_product uuid, p_key text, p_name text, p_meaning text)
returns public.product_domains
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  made uuid;
begin
  made := public.product_knowledge_change(product, 'domains', 'add', null,
            jsonb_build_object('key', coalesce(p_key, ''), 'name', coalesce(p_name, ''), 'meaning', coalesce(p_meaning, '')), 'added');
  return (select d from public.product_domains d where d.id = made);
end;
$$;

-- Rewrites a live domain's name or meaning (a null keeps it); its key never changes. The same values
-- change nothing and log nothing; anything else logs `edited`.
create function public.product_domain_edit(p_workspace uuid, p_entry uuid, p_name text default null, p_meaning text default null)
returns public.product_domains
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_entry_product(p_workspace, 'domains', p_entry);
begin
  perform public.product_knowledge_change(product, 'domains', 'edit', p_entry,
            jsonb_strip_nulls(jsonb_build_object('name', p_name, 'meaning', p_meaning)), 'edited');
  return (select d from public.product_domains d where d.id = p_entry);
end;
$$;

-- Retires a live domain: it is kept, with its key, marked retired. Logs `retired`.
create function public.product_domain_retire(p_workspace uuid, p_entry uuid)
returns public.product_domains
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_entry_product(p_workspace, 'domains', p_entry);
begin
  perform public.product_knowledge_change(product, 'domains', 'retire', p_entry, '{}'::jsonb, 'retired');
  return (select d from public.product_domains d where d.id = p_entry);
end;
$$;

-- ── Proposals: `domains` beside the other kinds ──────────────────────────────────

-- As 20261212110000_product_knowledge.sql: a proposed domain's key is checked as an addition's, and an
-- edit or a retirement names a live domain of the product.
create or replace function public.product_knowledge_propose(p_workspace uuid, p_product uuid, p_kind text, p_action text, p_entry uuid default null, p_fields jsonb default '{}'::jsonb)
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
      if f ? 'domains' then
        perform public.product_glossary_domain_check(product.id, null, f->'domains');
      end if;
    elsif p_kind = 'domains' then
      perform public.product_domain_unique(product.id, f->>'key');
    end if;
  elsif p_kind = 'legal' then
    before_fields := public.product_legal_fields(public.product_legal_live(p_workspace, product.id, p_entry));
  elsif p_kind = 'domains' then
    before_fields := public.product_domain_fields(public.product_domain_live(p_workspace, product.id, p_entry));
  else
    before_fields := public.product_glossary_fields(public.product_glossary_live(p_workspace, product.id, p_entry))
                     || public.product_glossary_domains_object(public.product_glossary_domain_keys(p_entry));
    if f ? 'term' then
      perform public.product_glossary_unique(product.id, f->>'term', p_entry);
    end if;
    if f ? 'domains' then
      perform public.product_glossary_domain_check(product.id, p_entry, f->'domains');
    end if;
  end if;
  insert into public.product_knowledge_proposals (workspace_id, product_id, kind, action, legal_id, glossary_id, domain_id, fields, proposed_by)
  values (p_workspace, product.id, p_kind, p_action,
          case when p_kind = 'legal' then p_entry end, case when p_kind = 'glossary' then p_entry end,
          case when p_kind = 'domains' then p_entry end,
          f, (select auth.uid()))
  returning * into made;
  perform public.product_knowledge_log(product, p_kind, 'proposed', p_entry, made.id, before_fields, f);
  return made;
end;
$$;

-- As 20261212110000_product_knowledge.sql, a domain's proposal naming its domain.
create or replace function public.product_knowledge_approve(p_workspace uuid, p_proposal uuid)
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
  made := public.product_knowledge_apply(product, was.kind, was.action, coalesce(was.legal_id, was.glossary_id, was.domain_id),
            public.product_knowledge_fields(p_workspace, was.kind, was.action, was.fields, was.proposed_by), null);
  entry := (made->>'entry')::uuid;
  update public.product_knowledge_proposals x
     set state = 'approved', decided_by = (select auth.uid()), decided_at = now(),
         legal_id = case when x.kind = 'legal' then entry end, glossary_id = case when x.kind = 'glossary' then entry end,
         domain_id = case when x.kind = 'domains' then entry end
   where x.id = was.id
  returning * into decided;
  perform public.product_knowledge_log(product, was.kind, 'approved', entry, was.id, made->'before', made->'after');
  return decided;
end;
$$;

-- As 20261212110000_product_knowledge.sql, a domain's proposal naming its domain.
create or replace function public.product_knowledge_reject(p_workspace uuid, p_proposal uuid)
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
  perform public.product_knowledge_log(product, was.kind, 'rejected', coalesce(was.legal_id, was.glossary_id, was.domain_id), was.id, null, null);
  return decided;
end;
$$;

-- ── The read ─────────────────────────────────────────────────────────────────────

-- As 20261218090000_product_knowledge_authors.sql, with `domains` beside `legal` and `glossary`:
-- `{owner, delegate, decides, entries, proposals}`, each entry `{entry, key, name, meaning, retiredAt,
-- createdBy, createdAt, updatedAt}`, retired ones too, by key.
create or replace function public.product_knowledge_of(p_workspace uuid, p_product uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  k text;
  sections jsonb := '{}'::jsonb;
begin
  foreach k in array array['legal', 'glossary', 'domains'] loop
    sections := sections || jsonb_build_object(k, jsonb_build_object(
      'owner', public.product_knowledge_person(p_workspace,
                 (select n.user_id from public.product_knowledge_named(product.id, k) n where n.role = 'owner')),
      'delegate', public.product_knowledge_person(p_workspace,
                 (select n.user_id from public.product_knowledge_named(product.id, k) n where n.role = 'delegate')),
      'decides', public.product_knowledge_decides(product.id, k),
      'entries', case k
        when 'legal' then
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'entry', l.id, 'id', 'L-' || l.code || '-' || l.number, 'code', l.code, 'number', l.number,
                  'statement', l.statement, 'source', l.source,
                  'owner', public.product_knowledge_person(p_workspace, l.owner_id), 'retiredAt', l.retired_at,
                  'createdBy', public.product_knowledge_person(p_workspace, l.created_by),
                  'createdAt', l.created_at, 'updatedAt', l.updated_at)
                order by l.code collate "C", l.number), '[]'::jsonb)
           from public.product_legal l where l.product_id = product.id)
        when 'domains' then
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'entry', d.id, 'key', d.key, 'name', d.name, 'meaning', d.meaning, 'retiredAt', d.retired_at,
                  'createdBy', public.product_knowledge_person(p_workspace, d.created_by),
                  'createdAt', d.created_at, 'updatedAt', d.updated_at)
                order by d.key collate "C"), '[]'::jsonb)
           from public.product_domains d where d.product_id = product.id)
        else
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'entry', g.id, 'term', g.term, 'meaning', g.meaning, 'avoid', to_jsonb(g.avoid),
                  'domains', public.product_glossary_domain_keys(g.id), 'removedAt', g.removed_at,
                  'createdBy', public.product_knowledge_person(p_workspace, g.created_by),
                  'createdAt', g.created_at, 'updatedAt', g.updated_at)
                order by lower(g.term), g.removed_at nulls first, g.id), '[]'::jsonb)
           from public.product_glossary g where g.product_id = product.id)
      end,
      'proposals',
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'proposal', x.id, 'action', x.action, 'entry', coalesce(x.legal_id, x.glossary_id, x.domain_id), 'fields', x.fields,
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

-- ── A term's domains: the glossary's own functions, one argument wider ─────────────

-- As 20261212110000_product_knowledge.sql, with the domains the term names (null or empty: none).
drop function public.product_glossary_add(uuid, uuid, text, text, text[]);
create function public.product_glossary_add(p_workspace uuid, p_product uuid, p_term text, p_meaning text, p_avoid text[] default '{}', p_domains text[] default null)
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
            jsonb_strip_nulls(jsonb_build_object('term', coalesce(p_term, ''), 'meaning', coalesce(p_meaning, ''),
                                                 'avoid', to_jsonb(coalesce(p_avoid, '{}'::text[])), 'domains', to_jsonb(p_domains))),
            'added');
  return (select g from public.product_glossary g where g.id = made);
end;
$$;

-- As 20261212110000_product_knowledge.sql, with the domains the term names: null keeps them, an empty list
-- clears the active ones (a link to a retired domain stays).
drop function public.product_glossary_edit(uuid, uuid, text, text, text[]);
create function public.product_glossary_edit(p_workspace uuid, p_entry uuid, p_term text default null, p_meaning text default null, p_avoid text[] default null, p_domains text[] default null)
returns public.product_glossary
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_entry_product(p_workspace, 'glossary', p_entry);
begin
  perform public.product_knowledge_change(product, 'glossary', 'edit', p_entry,
            jsonb_strip_nulls(jsonb_build_object('term', p_term, 'meaning', p_meaning, 'avoid', to_jsonb(p_avoid), 'domains', to_jsonb(p_domains))), 'edited');
  return (select g from public.product_glossary g where g.id = p_entry);
end;
$$;

-- ── What agents read ─────────────────────────────────────────────────────────────

-- As 20261212110000_product_knowledge.sql, with `domains` (the product's active ones, `{key, name, meaning}`
-- by key) and, on each term, the keys of the active domains it names (`[]`: a cross-domain term). It is what
-- business_for_product() and business_for_repo_app() append, so both answer them. Internal.
create or replace function public.product_knowledge_for_agents(p_product uuid) returns jsonb
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
    'glossary', (select coalesce(jsonb_agg(jsonb_build_object('term', g.term, 'meaning', g.meaning, 'avoid', to_jsonb(g.avoid),
                        'domains', (select coalesce(jsonb_agg(dm.key order by dm.key collate "C"), '[]'::jsonb)
                                      from public.product_glossary_domains lk join public.product_domains dm on dm.id = lk.domain_id
                                     where lk.glossary_id = g.id and dm.retired_at is null))
                        order by lower(g.term), g.term), '[]'::jsonb)
                   from public.product_glossary g where g.product_id = p_product and g.removed_at is null),
    'domains', (select coalesce(jsonb_agg(jsonb_build_object('key', dm.key, 'name', dm.name, 'meaning', dm.meaning)
                        order by dm.key collate "C"), '[]'::jsonb)
                  from public.product_domains dm where dm.product_id = p_product and dm.retired_at is null))
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.product_domains enable row level security;

-- Membership is read once per statement (bug #1832): my_workspaces(), never is_member() of the row.
create policy "a member reads their workspace's domains" on public.product_domains
  for select to authenticated using (workspace_id in (select public.my_workspaces()));

-- Signed out: nothing. Signed in: reads only. Nobody, the service role included, writes it directly.
revoke all on public.product_domains from public, anon, authenticated, service_role;
grant select on public.product_domains to authenticated, service_role;

revoke execute on function public.product_domain_fields(public.product_domains) from public, anon, authenticated, service_role;
revoke execute on function public.product_domain_unique(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.product_domain_live(uuid, uuid, uuid) from public, anon, authenticated, service_role;

revoke execute on function public.product_domain_add(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.product_domain_add(uuid, uuid, text, text, text) to authenticated;
revoke execute on function public.product_domain_edit(uuid, uuid, text, text) from public, anon;
grant execute on function public.product_domain_edit(uuid, uuid, text, text) to authenticated;
revoke execute on function public.product_domain_retire(uuid, uuid) from public, anon;
grant execute on function public.product_domain_retire(uuid, uuid) to authenticated;

-- A term's domains, as the domains: a member reads, nobody writes, the service role included.
alter table public.product_glossary_domains enable row level security;

create policy "a member reads their workspace's term domains" on public.product_glossary_domains
  for select to authenticated using (workspace_id in (select public.my_workspaces()));

revoke all on public.product_glossary_domains from public, anon, authenticated, service_role;
grant select on public.product_glossary_domains to authenticated, service_role;

revoke execute on function public.product_glossary_domain_keys(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.product_glossary_domains_object(jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.product_glossary_domain_check(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.product_glossary_domain_link(uuid, uuid, jsonb) from public, anon, authenticated, service_role;

revoke execute on function public.product_glossary_add(uuid, uuid, text, text, text[], text[]) from public, anon;
grant execute on function public.product_glossary_add(uuid, uuid, text, text, text[], text[]) to authenticated;
revoke execute on function public.product_glossary_edit(uuid, uuid, text, text, text[], text[]) from public, anon;
grant execute on function public.product_glossary_edit(uuid, uuid, text, text, text[], text[]) to authenticated;
