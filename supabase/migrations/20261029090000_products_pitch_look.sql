-- A product's pitch look (PRD 859 s1, docs: .omni-loop/delivery/inbox/0859-pitch/spec.md). Each
-- product of a business carries the look its pitches are drawn in: `arcade` (Arcade poster, the
-- default) or `keynote` (Clean keynote). The look is per product, never per workspace: two products of
-- one workspace pitch in two looks. A PRD's product is the product of the repository it was built in.
--
-- Every member of the workspace reads it with the product (the products policy of
-- 20261019090000_business_store.sql). Nobody writes it directly: set_pitch_look() changes it, run as
-- the signed-in person, for whoever may edit Settings › Business (business_member_only(): any member
-- of the workspace), refusing with 42501 (not a member), P0002 (no such product) or 22023 (a look other
-- than arcade or keynote, `hint` = look). The kit reads a repository's look with pitch_look_for_repo():
-- the look of the repository's product, or `arcade` when the repository has none.
--
-- Proven by supabase/checks/products_pitch_look.sql.
-- Rollback: a follow-up migration drops set_pitch_look(), pitch_look_for_repo() and
-- products.pitch_look; nothing else reads them.

alter table public.products
  add column pitch_look text not null default 'arcade' check (pitch_look in ('arcade', 'keynote'));

comment on column public.products.pitch_look is
  'The look the product''s pitches are drawn in (PRD 859): arcade (Arcade poster, the default) or keynote (Clean keynote). Changed by set_pitch_look() only.';

-- Changes a product's pitch look. Whoever may edit Settings › Business may change it.
create function public.set_pitch_look(p_workspace uuid, p_product uuid, p_look text) returns public.products
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
  update public.products p set pitch_look = p_look
   where p.id = p_product and p.workspace_id = p_workspace
  returning * into changed;
  return changed;
end;
$$;

-- The pitch look of `repo`'s product, for the signed-in person's terminal: `arcade` when the
-- repository has no product (or is not listed). 42501 outside the caller's workspaces, as
-- business_workspace() says.
create function public.pitch_look_for_repo(p_repo text) returns text
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  look text;
begin
  select p.pitch_look into look
    from public.repositories r join public.products p on p.id = r.product_id
   where r.workspace_id = ws and r.full_name = lower(btrim(p_repo));
  return coalesce(look, 'arcade');
end;
$$;

revoke execute on function public.set_pitch_look(uuid, uuid, text) from public, anon;
grant execute on function public.set_pitch_look(uuid, uuid, text) to authenticated;
revoke execute on function public.pitch_look_for_repo(text) from public, anon;
grant execute on function public.pitch_look_for_repo(text) to authenticated;
