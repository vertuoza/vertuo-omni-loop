-- Who approves a product's PRDs, and how each person is reached (PRD 1322 s1, docs:
-- .omni-loop/delivery/inbox/1322-approval-handshake/spec.md §1 and §2).
--
-- - product_approvers: a product's Approvers list on Settings › Products › <product>, one row per
--   workspace member listed: `asked` (asked to approve its PRDs) or `skipped` (never asked). Every member
--   of the workspace reads it; only its owners write it, through product_approver_set() and
--   product_approver_remove(). A member who leaves the workspace leaves every list.
-- - dossier_approve(dossier), redefined: once the PRD's product (its repository's product) lists a member
--   asked to approve, only those members approve its PRDs. A repository with no product, or a product
--   with nobody asked, keeps PRD 1299's rule: any member of the workspace.
-- - alert_channels: each person's own switches, Phone alerts (Web Push) and Email, both off until they
--   turn one on. Read and written by that person only.
-- - push_subscriptions: each device a person subscribed to Web Push: its endpoint, its two keys and a
--   label. Read, written and removed by that person only. The service role reads both tables to send.
--
-- Proven by supabase/checks/product_approvers.sql.
--
-- Rollback: a follow-up migration restores dossier_approve() as 20261123090000_approvals.sql defines it,
-- then drops product_approver_remove(), product_approver_set() and the three tables. Nothing else reads
-- them; until an owner lists an approver, dossier_approve() behaves as before.

-- ── A product's approvers ────────────────────────────────────────────────────────

create table public.product_approvers (
  workspace_id uuid not null,
  product_id   uuid not null references public.products on delete cascade,
  user_id      uuid not null,
  state        text not null check (state in ('asked', 'skipped')),
  set_by       uuid references auth.users on delete set null,
  set_at       timestamptz not null default now(),
  primary key (product_id, user_id),
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index product_approvers_member_idx on public.product_approvers (workspace_id, user_id);

comment on table public.product_approvers is
  'PRD 1322: a product''s Approvers list, one row per listed member of its workspace, asked to approve its PRDs or skipped. Members read it; owners write it through product_approver_set() and product_approver_remove(). Once a member is asked, only asked members approve the product''s PRDs (dossier_approve()).';
comment on column public.product_approvers.state is
  'asked: asked to approve the product''s PRDs, and one of the few who may; skipped: listed, never asked, and may not approve while anyone is asked.';

alter table public.product_approvers enable row level security;

create policy "a member reads their workspace's approvers" on public.product_approvers
  for select to authenticated
  using (public.is_member(workspace_id));

revoke all on public.product_approvers from anon, authenticated, service_role;
grant select on public.product_approvers to authenticated, service_role;

-- Lists a member of the product's workspace as asked to approve or skipped, or changes their state.
-- Answers {product, member, state}. 42501 not an owner, P0002 no such product, 22023 a member of no
-- such workspace or another state.
create function public.product_approver_set(p_product uuid, p_member uuid, p_state text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select p.* into owned from public.products p where p.id = p_product for update;
  if not found then
    raise exception 'No such product.' using errcode = 'P0002';
  end if;
  if not public.is_owner(owned.workspace_id) then
    raise exception 'Only an owner of the workspace lists % approvers.', owned.name using errcode = '42501';
  end if;
  if p_state is null or p_state not in ('asked', 'skipped') then
    raise exception 'An approver is asked or skipped.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = owned.workspace_id and m.user_id = p_member) then
    raise exception 'That account is not a member of the workspace that owns %.', owned.name using errcode = '22023';
  end if;
  insert into public.product_approvers (workspace_id, product_id, user_id, state, set_by)
  values (owned.workspace_id, owned.id, p_member, p_state, (select auth.uid()))
  on conflict (product_id, user_id) do update
    set state = excluded.state, set_by = excluded.set_by, set_at = now();
  return jsonb_build_object('product', owned.id, 'member', p_member, 'state', p_state);
end;
$$;

-- Takes a member off the product's list. True when they were on it. 42501 not an owner, P0002 no such
-- product.
create function public.product_approver_remove(p_product uuid, p_member uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select p.* into owned from public.products p where p.id = p_product for update;
  if not found then
    raise exception 'No such product.' using errcode = 'P0002';
  end if;
  if not public.is_owner(owned.workspace_id) then
    raise exception 'Only an owner of the workspace lists % approvers.', owned.name using errcode = '42501';
  end if;
  delete from public.product_approvers a where a.product_id = owned.id and a.user_id = p_member;
  return found;
end;
$$;

-- ── Approving: only the product's approvers, once it lists one ───────────────────

-- Previous (20261123090000_approvals.sql): any member of the dossier's workspace approved. Now, once the
-- dossier's repository's product lists a member asked to approve, only those members do; 42501 names
-- the product. Everything else is unchanged. `create or replace` keeps the function's grants.
create or replace function public.dossier_approve(p_dossier uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  target  public.dossiers%rowtype;
  product public.products%rowtype;
  missing text[];
  pinned  jsonb;
  login   text;
  made    uuid;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target from public.dossiers d where d.id = p_dossier for share;
  if not found then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  if not public.is_member(target.workspace_id) then
    raise exception 'Only a member of the workspace that owns % approves its PRDs.', target.home_repo using errcode = '42501';
  end if;
  select p.* into product
    from public.repositories r
    join public.products p on p.id = r.product_id
   where r.workspace_id = target.workspace_id and r.full_name = target.home_repo;
  if found
     and exists (select 1 from public.product_approvers a where a.product_id = product.id and a.state = 'asked')
     and not exists (select 1 from public.product_approvers a
                      where a.product_id = product.id and a.user_id = caller and a.state = 'asked') then
    raise exception 'Only %''s approvers approve its PRDs: a workspace owner lists them on Settings › Products.', product.name
      using errcode = '42501';
  end if;
  if target.kind <> 'prd' or target.prd is null then
    raise exception 'Only a numbered PRD is approved: number it with its first push.' using errcode = '22023';
  end if;
  if target.birthplace is distinct from 'server' then
    raise exception 'PRD #% was born in the repository: its phase-0 pull request approves it.', target.prd using errcode = '22023';
  end if;
  select array_agg(k order by o) into missing
    from unnest(array['spec', 'plan', 'before-after']) with ordinality as w (k, o)
   where not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id and v.kind = w.k);
  if missing is not null then
    raise exception 'PRD #% has no % yet: push it first.', target.prd, array_to_string(missing, ', ') using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
           'kind', l.kind,
           'path', case l.kind when 'spec' then 'spec.md' when 'plan' then 'plan.md'
                               when 'before-after' then 'before-after.html' when 'voice' then 'voice.json' end,
           'sha256', l.sha256,
           'version_id', l.id) order by l.o)
    into pinned
    from (
      select distinct on (v.kind) v.kind, v.sha256, v.id, k.o
        from public.dossier_versions v
        join unnest(array['spec', 'plan', 'before-after', 'voice']) with ordinality as k (kind, o) on k.kind = v.kind
       where v.dossier_id = target.id
       order by v.kind, v.created_at desc, v.id desc
    ) l;

  select lower(coalesce(nullif(p.github_login, ''), (
           select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
             from auth.identities i
            where i.user_id = caller and i.provider = 'github'
            order by i.created_at limit 1),
           (select u.email from auth.users u where u.id = caller),
           caller::text))
    into login
    from (select 1) one
    left join public.players p on p.workspace_id = target.workspace_id and p.user_id = caller;

  insert into public.approvals (dossier_id, approved_by, approver_login, files)
  values (target.id, caller, left(login, 200), pinned)
  returning id into made;

  return jsonb_build_object('id', made, 'repo', target.home_repo, 'prd', target.prd);
end;
$$;

-- ── How each person is reached ───────────────────────────────────────────────────

create table public.alert_channels (
  user_id    uuid primary key references auth.users on delete cascade,
  push       boolean not null default false,
  email      boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.alert_channels is
  'PRD 1322: each person''s own alert switches, Phone alerts (Web Push to their subscribed devices) and Email (to their sign-in address), both off by default. Read and written by that person only; the service role reads them to send.';

alter table public.alert_channels enable row level security;

create policy "a person reads their own alert channels" on public.alert_channels
  for select to authenticated using (user_id = (select auth.uid()));
create policy "a person sets their own alert channels" on public.alert_channels
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "a person changes their own alert channels" on public.alert_channels
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.alert_channels from anon, authenticated, service_role;
grant select, insert, update on public.alert_channels to authenticated;
grant select on public.alert_channels to service_role;

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  endpoint     text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 2000),
  p256dh       text not null check (char_length(p256dh) between 1 and 200),
  auth         text not null check (char_length(auth) between 1 and 200),
  device_label text not null default '' check (char_length(device_label) <= 120),
  created_at   timestamptz not null default now(),
  unique (user_id, endpoint)
);

comment on table public.push_subscriptions is
  'PRD 1322: each device a person subscribed to Web Push: the push service''s endpoint, the p256dh and auth keys, and a label. Read, written and removed by that person only; the service role reads them to send and removes one its push service says is gone (404 or 410).';

alter table public.push_subscriptions enable row level security;

create policy "a person reads their own devices" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "a person subscribes their own device" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "a person changes their own device" on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "a person removes their own device" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, authenticated, service_role;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, delete on public.push_subscriptions to service_role;

revoke execute on function public.product_approver_set(uuid, uuid, text) from public, anon;
revoke execute on function public.product_approver_remove(uuid, uuid) from public, anon;
grant execute on function public.product_approver_set(uuid, uuid, text) to authenticated;
grant execute on function public.product_approver_remove(uuid, uuid) to authenticated;
