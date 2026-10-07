-- A product's Pitch settings (PRD 1108 s1, docs: .omni-loop/delivery/inbox/1108-pitch-studio/spec.md,
-- "1. Pitch settings, per product"). Each product of a business carries one `pitch` value: its look
-- (colours, Heading and Text fonts, logo, theme), voice, intro and outro, music and length, its schema
-- in kit/lib/pitch/settings.ts. A stored value may be partial: what it leaves out comes from its look's
-- preset (`arcade` or `keynote`, PRD 859's two looks), then from the defaults, when the kit or the page
-- parses it.
--
-- - `products.pitch`: a JSON object, `{}` for a product that never set one (it reads as the defaults).
--   Each existing product's `pitch_look` becomes `{"look": {"preset": <its look>}}`, so it reads as the
--   matching preset. `pitch_look` is kept, and kept in step: set_pitch_settings() writes the preset it
--   names there, and set_pitch_look() resets the look to its preset, so the previous app still reads it.
-- - set_pitch_settings() changes it, run as the signed-in person, for whoever may edit Settings ›
--   Business (business_member_only(): any member of the workspace), refusing with 42501 (not a member),
--   P0002 (no such product) or 22023 (a value out of shape, `hint` = pitch). The database refuses what
--   would never parse — not an object, over 16 KB, a preset it does not know, instructions over 600
--   characters, a length outside 15–60 s — and leaves the rest of the schema to the kit's parser.
-- - pitch_settings_for_repo() answers the kit the stored value of the repository's product, `{}` for a
--   repository with no product.
-- - The bucket `pitch-assets`: private, 20 MB a file, the logos, fonts and music a product uploads. An
--   object's path is `<workspace id>/<product id>/<name>`; a member of the product's workspace uploads,
--   replaces, removes and reads it, and nobody else.
--
-- Proven by supabase/checks/pitch_settings.sql.
-- Rollback: a follow-up migration drops set_pitch_settings(), pitch_settings_for_repo(),
-- pitch_from_look(), pitch_asset_product(), the four storage policies, the bucket once emptied, and
-- products.pitch, and restores set_pitch_look() of 20261101090000_products_pitch_look.sql. pitch_look
-- holds every product's preset throughout, so nothing is lost.

-- ── The value ────────────────────────────────────────────────────────────────────

alter table public.products
  add column pitch jsonb not null default '{}'::jsonb
    check (jsonb_typeof(pitch) = 'object' and octet_length(pitch::text) <= 16384);

comment on column public.products.pitch is
  'The product''s Pitch settings (PRD 1108): look, voice, intro, outro, music and length, its schema in kit/lib/pitch/settings.ts; a field left out reads as its preset''s or the default. Changed by set_pitch_settings() and set_pitch_look() only.';

-- The settings a PRD 859 look reads as: its preset, every other field left to the defaults.
create function public.pitch_from_look(p_look text) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('look', jsonb_build_object('preset', p_look))
$$;

update public.products set pitch = public.pitch_from_look(pitch_look);

-- ── Who may write ────────────────────────────────────────────────────────────────

-- A `pitch` value the kit's parser could never read, as a 22023 naming the field; null when it may be.
create function public.pitch_refusal(p_pitch jsonb) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  preset text := p_pitch #>> '{look,preset}';
  instructions jsonb := p_pitch #> '{voice,instructions}';
  bound text;
begin
  if p_pitch is null or jsonb_typeof(p_pitch) <> 'object' then
    return 'Pitch settings: an object.';
  end if;
  if octet_length(p_pitch::text) > 16384 then
    return 'Pitch settings: at most 16 KB.';
  end if;
  if p_pitch #> '{look,preset}' is not null and (jsonb_typeof(p_pitch #> '{look,preset}') <> 'string' or preset not in ('arcade', 'keynote')) then
    return 'Look preset: arcade or keynote.';
  end if;
  if instructions is not null and (jsonb_typeof(instructions) <> 'string' or char_length(instructions #>> '{}') > 600) then
    return 'Voice instructions: at most 600 characters.';
  end if;
  foreach bound in array array['min', 'max'] loop
    if p_pitch -> 'length' -> bound is not null and (
         jsonb_typeof(p_pitch -> 'length' -> bound) <> 'number'
         or (p_pitch -> 'length' ->> bound)::numeric not between 15 and 60) then
      return 'Length: 15 to 60 seconds.';
    end if;
  end loop;
  return null;
end;
$$;

-- Changes a product's Pitch settings. Whoever may edit Settings › Business may change them.
create function public.set_pitch_settings(p_workspace uuid, p_product uuid, p_pitch jsonb) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  refusal text;
  changed public.products;
begin
  perform public.business_member_only(p_workspace);
  refusal := public.pitch_refusal(p_pitch);
  if refusal is not null then
    raise exception '%', refusal using errcode = '22023', hint = 'pitch';
  end if;
  perform public.business_product(p_workspace, p_product);
  update public.products p
     set pitch = p_pitch,
         pitch_look = coalesce(p_pitch #>> '{look,preset}', p.pitch_look)
   where p.id = p_product and p.workspace_id = p_workspace
  returning * into changed;
  return changed;
end;
$$;

-- PRD 859's dropdown, kept in step: choosing a look resets the product's look to that preset, and keeps
-- the rest of its settings.
create or replace function public.set_pitch_look(p_workspace uuid, p_product uuid, p_look text) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.products;
begin
  perform public.business_member_only(p_workspace);
  if p_look is null or p_look not in ('arcade', 'keynote') then
    raise exception 'Look: arcade or keynote.' using errcode = '22023', hint = 'look';
  end if;
  perform public.business_product(p_workspace, p_product);
  update public.products p
     set pitch_look = p_look,
         pitch = p.pitch || public.pitch_from_look(p_look)
   where p.id = p_product and p.workspace_id = p_workspace
  returning * into changed;
  return changed;
end;
$$;

-- ── What the kit calls ───────────────────────────────────────────────────────────

-- The Pitch settings of `repo`'s product, as stored, for the signed-in person's terminal: `{}` when the
-- repository has no product (or is not listed). 42501 outside the caller's workspaces, as
-- business_workspace() says.
create function public.pitch_settings_for_repo(p_repo text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  found_one jsonb;
begin
  select p.pitch into found_one
    from public.repositories r join public.products p on p.id = r.product_id
   where r.workspace_id = ws and r.full_name = lower(btrim(p_repo));
  return coalesce(found_one, '{}'::jsonb);
end;
$$;

revoke execute on function public.pitch_from_look(text) from public, anon, authenticated;
revoke execute on function public.pitch_refusal(jsonb) from public, anon, authenticated;
revoke execute on function public.set_pitch_settings(uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_pitch_settings(uuid, uuid, jsonb) to authenticated;
revoke execute on function public.pitch_settings_for_repo(text) from public, anon;
grant execute on function public.pitch_settings_for_repo(text) to authenticated;

-- ── The bucket ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pitch-assets', 'pitch-assets', false, 20971520, array[
  'image/svg+xml', 'image/png', 'image/jpeg', 'image/webp',
  'font/woff2', 'font/woff', 'font/ttf', 'font/otf',
  'audio/mpeg', 'audio/wav', 'audio/ogg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The product a pitch asset's path names — `<workspace id>/<product id>/<name>`, the product one of that
-- workspace's and the caller a member of it — or null for any other.
create function public.pitch_asset_product(path text) returns uuid
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one uuid;
begin
  if path is null or path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,120}$' then
    return null;
  end if;
  select p.id into found_one
    from public.products p
   where p.id = split_part(path, '/', 2)::uuid
     and p.workspace_id = split_part(path, '/', 1)::uuid
     and public.is_member(p.workspace_id);
  return found_one;
end;
$$;

revoke execute on function public.pitch_asset_product(text) from public, anon;
grant execute on function public.pitch_asset_product(text) to authenticated;

create policy "a member reads their workspace's pitch assets" on storage.objects
  for select to authenticated
  using (bucket_id = 'pitch-assets' and public.pitch_asset_product(name) is not null);

create policy "a member uploads their workspace's pitch assets" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pitch-assets' and public.pitch_asset_product(name) is not null);

create policy "a member replaces their workspace's pitch assets" on storage.objects
  for update to authenticated
  using (bucket_id = 'pitch-assets' and public.pitch_asset_product(name) is not null)
  with check (bucket_id = 'pitch-assets' and public.pitch_asset_product(name) is not null);

create policy "a member removes their workspace's pitch assets" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pitch-assets' and public.pitch_asset_product(name) is not null);
