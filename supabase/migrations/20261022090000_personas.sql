-- Personas (PRD 799, docs: .omni-loop/delivery/inbox/0799-business-personas/spec.md). Each product of a
-- business (PRD 748) holds any number of personas: the team's own picture of its customers, each with a
-- name, a stance, a trade, an avatar into that trade's sprite variations (packages/design), who they are
-- and how they use the product. They are not claims: no source, state or receipt, edited directly.
--
--   personas                 one row per persona, on a product; a deleted one keeps its row until
--                            restored, so Undo brings back the same persona in the same place
--   valid_persona_avatar()   the ranges packages/design draws: {v 1, skin 0–5, hair 0–5, hairColor 0–3,
--                            outfit 0–3, accessory 0–3}
--
--   persona_add(workspace, product, name, stance, trade, avatar, who, usage)
--   persona_edit(workspace, persona, name, stance, trade, avatar, who, usage)
--   persona_delete(workspace, persona) · persona_restore(workspace, persona)   Delete, and its Undo
--   business_for_repo(repo)  now also `personas`: the repository's product's, oldest first, `[]` without
--
-- Every member of the workspace reads the personas that are not deleted (row-level security by
-- is_member()). Nobody writes the table directly: every write goes through a security-definer function
-- run as the signed-in person, built like 20261019090000_business_store.sql, refusing with 42501 (not a
-- member), P0002 (gone) or 22023 (invalid, the field in `hint`). persona_add() also takes the service
-- role, which scripts/personas-import.mjs acts as, through the same checks. Any member writes.
--
-- A trade is a short lower-case word (`plumber`, `heating`): the list of trades lives in
-- packages/design, so adding one is adding a body, not a migration (decision 10).
--
-- Nothing is seeded: a new workspace has no persona.
--
-- Proven by supabase/checks/personas.sql.
-- Rollback: a follow-up migration drops personas, the persona functions and valid_persona_avatar(),
-- and restores business_for_repo() from 20261021090000_business_evidence.sql; nothing else reads them.

-- ── The table ────────────────────────────────────────────────────────────────────

-- True exactly when `p_avatar` is `{v, skin, hair, hairColor, outfit, accessory}`, each a whole number in
-- its range, and nothing else.
create function public.valid_persona_avatar(p_avatar jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_avatar) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p_avatar) k)
        = array['accessory', 'hair', 'hairColor', 'outfit', 'skin', 'v']
    and (select bool_and(jsonb_typeof(p_avatar -> k) = 'number' and (p_avatar ->> k) ~ '^[0-9]+$')
           from unnest(array['v', 'skin', 'hair', 'hairColor', 'outfit', 'accessory']) k)
    and (p_avatar ->> 'v') = '1'
    and (p_avatar ->> 'skin')::numeric between 0 and 5
    and (p_avatar ->> 'hair')::numeric between 0 and 5
    and (p_avatar ->> 'hairColor')::numeric between 0 and 3
    and (p_avatar ->> 'outfit')::numeric between 0 and 3
    and (p_avatar ->> 'accessory')::numeric between 0 and 3,
    false)
$$;

comment on function public.valid_persona_avatar(jsonb) is
  'A persona''s avatar (PRD 799): {v 1, skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3}, whole numbers, no other key. packages/design exports the same ranges.';

create table public.personas (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id   uuid not null references public.products on delete cascade,
  ordinal      bigint generated always as identity,
  name         text not null check (char_length(name) between 1 and 40 and name !~ '[\r\n\t]'),
  stance       text not null check (stance in ('excited', 'neutral', 'skeptical')),
  trade        text not null check (char_length(trade) <= 40 and trade ~ '^[a-z]+$'),
  avatar       jsonb not null check (public.valid_persona_avatar(avatar)),
  who          text not null default '' check (char_length(who) <= 400),
  usage        text not null default '' check (char_length(usage) <= 400),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index personas_product_idx on public.personas (product_id, ordinal) where deleted_at is null;

comment on table public.personas is
  'A product''s personas (PRD 799): who the customer is, as the team pictures them. Not claims. Listed oldest first (ordinal). deleted_at: deleted, kept so persona_restore() (Undo) brings it back; nobody reads it meanwhile.';

-- ── Who may write ────────────────────────────────────────────────────────────────

-- A persona's fields as a person gave them, trimmed where they are one line, or 22023 naming the field.
create function public.persona_fields(p_name text, p_stance text, p_trade text, p_avatar jsonb, p_who text, p_usage text,
                                      out name text, out stance text, out trade text, out avatar jsonb, out who text, out usage text)
language plpgsql immutable
set search_path = ''
as $$
begin
  name := btrim(coalesce(p_name, ''));
  if char_length(name) not between 1 and 40 or name ~ '[\r\n\t]' then
    raise exception 'Name: 1 to 40 characters, on one line.' using errcode = '22023', hint = 'name';
  end if;
  if p_stance is null or p_stance not in ('excited', 'neutral', 'skeptical') then
    raise exception 'Stance: excited, neutral or skeptical.' using errcode = '22023', hint = 'stance';
  end if;
  stance := p_stance;
  trade := btrim(coalesce(p_trade, ''));
  if char_length(trade) > 40 or trade !~ '^[a-z]+$' then
    raise exception 'Trade: a short lower-case word, like plumber or heating.' using errcode = '22023', hint = 'trade';
  end if;
  if not public.valid_persona_avatar(p_avatar) then
    raise exception 'Avatar: {v 1, skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3}.' using errcode = '22023', hint = 'avatar';
  end if;
  avatar := p_avatar;
  who := btrim(coalesce(p_who, ''));
  if char_length(who) > 400 then
    raise exception 'Who: 400 characters at most.' using errcode = '22023', hint = 'who';
  end if;
  usage := btrim(coalesce(p_usage, ''));
  if char_length(usage) > 400 then
    raise exception 'Usage: 400 characters at most.' using errcode = '22023', hint = 'usage';
  end if;
end;
$$;

-- Adds a persona to a product of the workspace. A member, or the service role (the import).
create function public.persona_add(p_workspace uuid, p_product uuid, p_name text, p_stance text, p_trade text,
                                   p_avatar jsonb, p_who text, p_usage text)
returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  made public.personas;
begin
  perform public.business_runner_only(p_workspace);
  select * into f from public.persona_fields(p_name, p_stance, p_trade, p_avatar, p_who, p_usage);
  if p_product is null then
    raise exception 'Product: a persona belongs to a product.' using errcode = '22023', hint = 'product';
  end if;
  perform public.business_product(p_workspace, p_product);
  insert into public.personas (workspace_id, product_id, name, stance, trade, avatar, who, usage, created_by)
  values (p_workspace, p_product, f.name, f.stance, f.trade, f.avatar, f.who, f.usage, auth.uid())
  returning * into made;
  return made;
end;
$$;

-- A persona of the workspace that is not deleted, or P0002.
create function public.persona_of(p_workspace uuid, p_persona uuid, p_deleted boolean) returns public.personas
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one public.personas;
begin
  select * into found_one from public.personas p
   where p.id = p_persona and p.workspace_id = p_workspace and (p.deleted_at is not null) = p_deleted;
  if not found then
    raise exception 'Persona: no such persona in this workspace.' using errcode = 'P0002', hint = 'persona';
  end if;
  return found_one;
end;
$$;

-- Changes every field of a persona; it stays on its product and in its place.
create function public.persona_edit(p_workspace uuid, p_persona uuid, p_name text, p_stance text, p_trade text,
                                    p_avatar jsonb, p_who text, p_usage text)
returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  changed public.personas;
begin
  perform public.business_member_only(p_workspace);
  select * into f from public.persona_fields(p_name, p_stance, p_trade, p_avatar, p_who, p_usage);
  perform public.persona_of(p_workspace, p_persona, false);
  update public.personas p
     set name = f.name, stance = f.stance, trade = f.trade, avatar = f.avatar, who = f.who, usage = f.usage, updated_at = now()
   where p.id = p_persona
  returning * into changed;
  return changed;
end;
$$;

-- Deletes a persona at once: nobody reads it any more, and persona_restore() brings it back.
create function public.persona_delete(p_workspace uuid, p_persona uuid) returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.personas;
begin
  perform public.business_member_only(p_workspace);
  perform public.persona_of(p_workspace, p_persona, false);
  update public.personas p set deleted_at = now(), updated_at = now() where p.id = p_persona returning * into changed;
  return changed;
end;
$$;

-- Undo: brings a deleted persona back, as it was and where it was.
create function public.persona_restore(p_workspace uuid, p_persona uuid) returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.personas;
begin
  perform public.business_member_only(p_workspace);
  perform public.persona_of(p_workspace, p_persona, true);
  update public.personas p set deleted_at = null, updated_at = now() where p.id = p_persona returning * into changed;
  return changed;
end;
$$;

-- ── What the kit calls ───────────────────────────────────────────────────────────

-- As 20261021090000_business_evidence.sql, plus `personas`: the repository's product's personas that are
-- not deleted, oldest first, as {name, stance, trade, who, usage}; `[]` with no business, no product or
-- none. `state` still comes from claims only (decision 11).
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
  cast_of jsonb;
begin
  select * into biz from public.businesses b where b.workspace_id = ws;
  if not found then
    return jsonb_build_object('state', 'none', 'business', null, 'product', null, 'claims', '[]'::jsonb, 'personas', '[]'::jsonb);
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

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.personas enable row level security;

create policy "a member reads their workspace's personas" on public.personas
  for select to authenticated using (public.is_member(workspace_id) and deleted_at is null);

-- Signed out: nothing. Signed in: reads only, the rows above. Nobody, the service role included, writes
-- the table directly.
revoke all on public.personas from public, anon, authenticated, service_role;
grant select on public.personas to authenticated, service_role;

revoke execute on function public.persona_fields(text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.persona_of(uuid, uuid, boolean) from public, anon, authenticated;

-- A pure check of the ranges: anyone may ask it.
grant execute on function public.valid_persona_avatar(jsonb) to anon, authenticated, service_role;

revoke execute on function public.persona_add(uuid, uuid, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.persona_add(uuid, uuid, text, text, text, jsonb, text, text) to authenticated, service_role;
revoke execute on function public.persona_edit(uuid, uuid, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.persona_edit(uuid, uuid, text, text, text, jsonb, text, text) to authenticated;
revoke execute on function public.persona_delete(uuid, uuid) from public, anon;
grant execute on function public.persona_delete(uuid, uuid) to authenticated;
revoke execute on function public.persona_restore(uuid, uuid) from public, anon;
grant execute on function public.persona_restore(uuid, uuid) to authenticated;
