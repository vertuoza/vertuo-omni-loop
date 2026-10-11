-- A product PRD: a dossier keyed by its product and a counter, `mobile-12`, with no home repository
-- (PRD 1548 s1, docs: .omni-loop/delivery/inbox/1548-product-gate/spec.md, "A product PRD").
--
-- - products.key: lowercase kebab-case, each part starting with a letter (`mobile`, `field-app`), at
--   most 40 characters, unique in its workspace, null until an owner of the workspace sets it with
--   product_set_key(). Once set it never changes (products_key_once). A key never ends in `-<digits>`,
--   so `<key>-<n>` reads one way, and never looks like a GitHub number.
-- - products.prd_count: the product's last PRD number, 0 before its first. A new product PRD takes the
--   next one by updating the product's row, which locks it: two creates at once wait for each other and
--   take two numbers, and a create rolled back gives its number back, so the numbers have no gap.
-- - dossiers.product_seq: a product PRD's number on its product. dossiers.home_repo is no longer
--   required: a dossier is keyed by exactly one of its home repository (with its PRD number, or none
--   while a draft) and its product's counter (dossiers_key); a product PRD is a `prd` dossier with no
--   repository number (dossiers_product_prd), numbered from its birth (dossiers_numbered), unique per
--   product, and born on the server (birthplace `server`). Neither its number nor its product ever
--   changes (dossiers_product_prd_fixed); only its product's deletion empties the product.
-- - "the opener deletes their own draft" now spares a product PRD, which has no repository number but
--   is no draft.
-- - prd_dossier(repo, prd, product): the PRD dossier the caller reads, found by either key: the product
--   key and the PRD's number on it when `product` is given (among the caller's workspaces, the one
--   listing `repo` first when two hold the key), else the home repository and its number, as before.
-- - dossier_push() takes p_product_key: with it, p_prd null creates the product's next PRD and p_prd n
--   pushes to PRD `<key>-<n>`; p_repo then only says which workspace, when two of the caller's hold the
--   key. Its answer gains prdId, `<key>-<n>`, for a product PRD only. Without it, as
--   20261129100000_prd_product.sql.
-- - dossier_approve() approves a product PRD as a numbered ◆ one, and answers prdId too.
-- - dossier_approval() and approval_request() take p_product, the product key, finding the PRD by
--   prd_dossier(); approval_request() answers prdId. A product PRD's repo and prd read null.
-- - The approval stream reads a product PRD's dossier as the caller, by products.key and
--   dossiers.product_seq (granted here), through row-level security as before.
--
-- Proven by supabase/checks/product_prd_ids.sql; supabase/checks/dossiers.sql, approvals.sql and
-- approval_requests.sql still pass unchanged.
--
-- Rollback (the down script): a follow-up migration that first runs
-- `select public.product_prd_ids_rollback_guard();`, which refuses (55000) while any product PRD exists,
-- then restores dossier_push() of 20261129100000_prd_product.sql, dossier_approve() and
-- approval_request() of 20261129110000_product_lookups.sql and dossier_approval() of
-- 20261126090000_approval_voiding.sql, recreates the draft-deletion policy of
-- 20260928090000_dossiers.sql, drops product_set_key(), prd_dossier(), product_of_key(), prd_id_of(),
-- the guard, the two triggers and their functions, the three dossier constraints (restoring
-- dossiers_numbered as `(prd is null) = (numbered_at is null)`), dossiers.product_seq, products.key and
-- products.prd_count, and sets dossiers.home_repo not null again. After a product PRD exists, keep it.

-- ── A product's key and counter ──────────────────────────────────────────────────

alter table public.products
  add column key text
    constraint products_key_shape check (key ~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' and char_length(key) <= 40),
  add column prd_count integer not null default 0 constraint products_prd_count_check check (prd_count >= 0),
  add constraint products_workspace_key unique (workspace_id, key);

comment on column public.products.key is
  'PRD 1548: the product''s key in its PRDs'' ids (mobile, as in mobile-12): lowercase kebab-case, each part starting with a letter, unique in the workspace. Set once by an owner (product_set_key()), never changed.';
comment on column public.products.prd_count is
  'PRD 1548: the product''s last PRD number (0 before its first). dossier_push() takes the next one under the row''s lock, so numbers have no gap.';

-- A product's key, once set, never changes.
create function public.products_key_once() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.key is not null and new.key is distinct from old.key then
    raise exception 'A product''s key is set once: % stays %.', old.name, old.key using errcode = '22023', hint = 'key';
  end if;
  return new;
end;
$$;

create trigger products_key_once
  before update of key on public.products
  for each row execute function public.products_key_once();

-- Sets the product's key, once, for an owner of its workspace. Answers {id, name, key}; setting the key
-- it already has answers the same. 42501 signed out or not an owner, P0002 no such product, 22023 a key
-- out of shape, another product's key in the workspace, or a key already set.
create function public.product_set_key(p_product uuid, p_key text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
  v_key text := btrim(coalesce(p_key, ''));
begin
  owned := public.product_repository_owned(p_product);
  if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
    raise exception 'Key: lowercase kebab-case of at most 40 characters, each part starting with a letter, as mobile or field-app.'
      using errcode = '22023', hint = 'key';
  end if;
  if owned.key is distinct from v_key then
    if exists (select 1 from public.products p where p.workspace_id = owned.workspace_id and p.key = v_key) then
      raise exception 'Key: another product of this workspace is %.', v_key using errcode = '22023', hint = 'key';
    end if;
    update public.products p set key = v_key where p.id = owned.id;
  end if;
  return jsonb_build_object('id', owned.id, 'name', owned.name, 'key', v_key);
end;
$$;

-- ── A dossier keyed by its product ───────────────────────────────────────────────

alter table public.dossiers
  alter column home_repo drop not null,
  add column product_seq integer constraint dossiers_product_seq_check check (product_seq > 0),
  add constraint dossiers_key check (num_nonnulls(home_repo, product_seq) = 1),
  add constraint dossiers_product_prd check (product_seq is null or (kind = 'prd' and prd is null)),
  add constraint dossiers_product_seq_key unique (product_id, product_seq),
  drop constraint dossiers_numbered,
  add constraint dossiers_numbered check ((prd is null and product_seq is null) = (numbered_at is null));

comment on column public.dossiers.home_repo is
  'owner/name in lower case: the repository whose issue the PRD is, where the brainstorm ran. Null for a product PRD (PRD 1548), which is keyed by product_id and product_seq instead.';
comment on column public.dossiers.product_seq is
  'PRD 1548: a product PRD''s number on its product (12 in mobile-12); null for a dossier of a repository. Set at its birth, never changed.';

grant select (product_seq) on public.dossiers to authenticated;

-- A product PRD keeps its number and its product; only its product's deletion empties the product (a
-- referential action runs inside a trigger, a direct update does not).
create function public.dossiers_product_prd_fixed() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.product_seq is distinct from old.product_seq
     or (old.product_seq is not null and new.product_id is distinct from old.product_id
         and (new.product_id is not null or pg_trigger_depth() = 1)) then
    raise exception 'A product PRD keeps its product and its number.' using errcode = '22023', hint = 'product';
  end if;
  return new;
end;
$$;

create trigger dossiers_product_prd_fixed
  before update of product_id, product_seq on public.dossiers
  for each row execute function public.dossiers_product_prd_fixed();

-- A product PRD is no draft: the opener deletes a dossier with neither number only.
drop policy "the opener deletes their own draft" on public.dossiers;
create policy "the opener deletes their own draft" on public.dossiers
  for delete to authenticated
  using (opened_by = (select auth.uid()) and prd is null and product_seq is null and public.is_member(workspace_id));

-- ── Finding a PRD by either key ──────────────────────────────────────────────────

-- A product PRD's id, `<key>-<n>`; null for a dossier of a repository or a product with no key.
create function public.prd_id_of(p_product uuid, p_seq integer) returns text
language sql stable
security definer
set search_path = ''
as $$
  select p.key || '-' || p_seq from public.products p where p.id = p_product and p_seq is not null
$$;

-- The product with key `p_key` in a workspace the caller belongs to: when two hold it, the one listing
-- `p_repo` (or owning its organisation) first, then the oldest product. Null when there is none.
create function public.product_of_key(p_key text, p_repo text default null) returns public.products
language sql stable
security definer
set search_path = ''
as $$
  select p.*
    from public.products p
    join public.workspaces w on w.id = p.workspace_id
   where p.key = btrim(coalesce(p_key, '')) and public.is_member(p.workspace_id)
   order by (exists (select 1 from public.repositories r
                      where r.workspace_id = p.workspace_id and r.full_name = lower(btrim(coalesce(p_repo, ''))))
             or lower(w.github_org) is not distinct from nullif(lower(split_part(btrim(coalesce(p_repo, '')), '/', 1)), '')) desc,
            p.created_at, p.id
   limit 1
$$;

-- The PRD dossier the caller reads, by either key: PRD `p_prd` of the product keyed `p_product` when it
-- is given, else PRD `p_prd` of repository `p_repo`, the latest numbered first. Null when there is none.
create function public.prd_dossier(p_repo text, p_prd integer, p_product text default null) returns public.dossiers
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  found_one public.dossiers;
  product   public.products;
begin
  if nullif(btrim(coalesce(p_product, '')), '') is not null then
    product := public.product_of_key(p_product, p_repo);
    select d.* into found_one from public.dossiers d
     where d.product_id = product.id and d.product_seq = p_prd and d.kind = 'prd';
    return found_one;
  end if;
  select d.* into found_one
    from public.dossiers d
   where d.home_repo = lower(btrim(coalesce(p_repo, ''))) and d.kind = 'prd' and d.prd = p_prd
     and public.is_member(d.workspace_id)
   order by d.numbered_at desc nulls last, d.id
   limit 1;
  return found_one;
end;
$$;

-- The down script's first statement: refuses while any product PRD exists, whose key a rollback loses.
create function public.product_prd_ids_rollback_guard() returns void
language plpgsql
set search_path = ''
as $$
declare
  held integer;
begin
  select count(*) into held from public.dossiers d where d.product_seq is not null;
  if held > 0 then
    raise exception 'Product PRDs exist (%): roll back no further than PRD 1548 s1, keep its migration.', held
      using errcode = '55000';
  end if;
end;
$$;

-- ── The kit's push, by either key ────────────────────────────────────────────────

drop function public.dossier_push(text, integer, text, uuid, jsonb, text, text);

-- As 20261129100000_prd_product.sql, with p_product_key: a product PRD, created (p_prd null) or pushed
-- to (p_prd its number). A product PRD's answer carries prdId.
create function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb, p_kind text default 'prd', p_product text default null, p_product_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_title   text := btrim(coalesce(p_title, ''));
  v_kind    text := coalesce(p_kind, 'prd');
  v_product text := lower(btrim(coalesce(p_product, '')));
  v_key     text := btrim(coalesce(p_product_key, ''));
  v_seq     integer;
  keyed     public.products%rowtype;
  pick      record;
  draft     public.dossiers%rowtype;
  target    public.dossiers%rowtype;
  item      jsonb;
  kinds     text[] := '{}';
  v_version integer;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
  in_force  public.approvals%rowtype;
  pinned    text;
  latest    public.dossier_versions%rowtype;
  named     uuid;
  product   public.products%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_kind not in ('prd', 'visual', 'bug', 'concept') then
    raise exception 'A dossier''s kind is prd, visual, bug or concept.' using errcode = '22023';
  end if;
  if v_key <> '' then
    if v_kind <> 'prd' or p_draft is not null or v_product <> '' then
      raise exception 'A product PRD is a PRD of its product alone: no draft, no other kind, no product name.' using errcode = '22023';
    end if;
    if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
      raise exception 'A product key is lowercase kebab-case, as mobile.' using errcode = '22023';
    end if;
    if v_repo <> '' and (v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200) then
      raise exception 'A push names its repository as owner/name.' using errcode = '22023';
    end if;
    if p_prd is not null and p_prd <= 0 then
      raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
    end if;
  else
    if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
      raise exception 'A push names its repository as owner/name.' using errcode = '22023';
    end if;
    if p_prd is null or p_prd <= 0 then
      raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
    end if;
  end if;
  if char_length(v_title) not between 1 and 200 then
    raise exception 'A push carries a title of 1 to 200 characters.' using errcode = '22023';
  end if;
  if p_artifacts is null or jsonb_typeof(p_artifacts) <> 'array' then
    raise exception 'The artifacts are a list of {kind, content}.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_artifacts) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item ->> 'kind', '') not in ('spec', 'plan', 'before-after', 'variations', 'bug-record', 'voice', 'concept-record', 'vision', 'board', 'debate')
       or jsonb_typeof(item -> 'content') is distinct from 'string' then
      raise exception 'Each artifact is {kind, content}, its kind one of spec, plan, before-after, variations, bug-record, voice, concept-record, vision, board, debate.' using errcode = '22023';
    end if;
    if (item ->> 'kind') not in ('variations', 'board') and (item ->> 'kind') = any (kinds) then
      raise exception 'Each kind is sent once: % came twice.', item ->> 'kind' using errcode = '22023';
    end if;
    if not public.dossier_takes(v_kind, item ->> 'kind') then
      raise exception 'A % dossier takes no % version.', v_kind, item ->> 'kind' using errcode = '22023';
    end if;
    kinds := kinds || (item ->> 'kind');
  end loop;

  if v_key <> '' then
    keyed := public.product_of_key(v_key, v_repo);
    if keyed.id is null then
      raise exception 'No product keyed % in your workspaces.', v_key using errcode = 'P0002';
    end if;
    if p_prd is null then
      -- The product's row is locked until this push commits: the next create waits, then takes the next
      -- number. A push rolled back takes its number back with it.
      update public.products p set prd_count = p.prd_count + 1 where p.id = keyed.id returning p.prd_count into v_seq;
      insert into public.dossiers (workspace_id, home_repo, kind, product_id, product_seq, title, opened_by, numbered_at, birthplace)
      values (keyed.workspace_id, null, 'prd', keyed.id, v_seq, v_title, caller, now(), 'server')
      returning * into target;
    else
      select d.* into target from public.dossiers d
       where d.product_id = keyed.id and d.product_seq = p_prd and d.kind = 'prd'
         for update;
      if not found then
        raise exception 'No PRD %-% on %.', v_key, p_prd, keyed.name using errcode = 'P0002';
      end if;
    end if;
  elsif p_draft is not null then
    if v_kind <> 'prd' then
      raise exception 'A % dossier has no draft: push it by its number alone.', v_kind using errcode = '22023';
    end if;
    select d.* into draft from public.dossiers d
     where d.id = p_draft and public.is_member(d.workspace_id)
       for update;
    if not found then
      raise exception 'No such draft dossier.' using errcode = 'P0002';
    end if;
    if draft.home_repo is distinct from v_repo then
      raise exception 'This draft belongs to %.', coalesce(draft.home_repo, 'its product') using errcode = '22023';
    end if;
    if draft.prd is not null and draft.prd <> p_prd then
      raise exception 'This dossier is already PRD #%.', draft.prd using errcode = '22023';
    end if;
    if draft.prd is not null then
      target := draft;
    else
      select d.* into target from public.dossiers d
       where d.workspace_id = draft.workspace_id and d.home_repo = v_repo and d.kind = 'prd' and d.prd = p_prd
         for update;
      if found then
        -- Numbered to a key already taken: the draft merges into that dossier, and goes.
        update public.dossier_versions v set dossier_id = target.id where v.dossier_id = draft.id;
        update public.dossiers d
           set claude_session_id = coalesce(draft.claude_session_id, d.claude_session_id),
               opened_by = coalesce(draft.opened_by, d.opened_by),
               created_at = least(d.created_at, draft.created_at)
         where d.id = target.id;
        delete from public.dossiers d where d.id = draft.id;
      else
        update public.dossiers d set prd = p_prd, numbered_at = now() where d.id = draft.id;
        target := draft;
      end if;
    end if;
  else
    select * into pick from public.repo_workspace(caller, v_repo);
    if pick.workspace_id is null then
      raise exception '%', pick.refusal using errcode = '42501';
    end if;
    insert into public.dossiers (workspace_id, home_repo, kind, prd, title, opened_by, numbered_at)
    values (pick.workspace_id, v_repo, v_kind, p_prd, v_title, caller, now())
    on conflict (workspace_id, home_repo, kind, prd) do nothing;
    select d.* into target from public.dossiers d
     where d.workspace_id = pick.workspace_id and d.home_repo = v_repo and d.kind = v_kind and d.prd = p_prd
       for update;
  end if;

  update public.dossiers d set title = v_title where d.id = target.id;

  -- Its birth, in a repository of several products: the one of them the push names. One product, or
  -- none, is the first version's to give (dossier_versions_product). A product PRD has its product.
  if v_product <> '' and target.product_id is null and target.home_repo is not null
     and not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id)
     and (select count(*) from public.product_repositories l
           where l.workspace_id = target.workspace_id and l.repository = target.home_repo) > 1 then
    select l.product_id into named
      from public.product_repositories l
      join public.products p on p.id = l.product_id
     where l.workspace_id = target.workspace_id and l.repository = target.home_repo and lower(p.name) = v_product
     limit 1;
    if named is not null then
      update public.dossiers d set product_id = named where d.id = target.id;
    end if;
  end if;

  -- The approval in force before this push: the latest, unless a void follows it.
  select a.* into in_force
    from public.approvals a
   where a.dossier_id = target.id
   order by a.approved_at desc, a.id desc
   limit 1;
  if found and exists (select 1 from public.approval_voids x where x.approval_id = in_force.id) then
    in_force := null;
  end if;

  for item in select value from jsonb_array_elements(p_artifacts) loop
    v_version := public.dossier_add_version(target.id, item ->> 'kind', item ->> 'content', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item ->> 'kind');
    else
      added := added || jsonb_build_object('kind', item ->> 'kind', 'version', v_version);
      if in_force.id is not null then
        select f.value ->> 'sha256' into pinned
          from jsonb_array_elements(in_force.files) f
         where f.value ->> 'kind' = item ->> 'kind'
           and f.value ->> 'kind' <> 'voice'
         limit 1;
        if pinned is not null then
          select v.* into latest
            from public.dossier_versions v
           where v.dossier_id = target.id and v.kind = item ->> 'kind'
           order by v.created_at desc, v.id desc
           limit 1;
          if latest.sha256 <> pinned then
            insert into public.approval_voids (approval_id, dossier_id, kind, from_sha256, to_sha256, pushed_by, pusher_login, version_id)
            values (in_force.id, target.id, latest.kind, pinned, latest.sha256, caller,
                    public.member_login(target.workspace_id, caller), latest.id);
          end if;
        end if;
      end if;
    end if;
  end loop;

  -- Each push links the PRD's repositories again, even one whose link a person removed.
  perform public.dossier_link_repositories(target.id);

  select d.* into target from public.dossiers d where d.id = target.id;
  select p.* into product from public.products p where p.id = target.product_id;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged,
    'product', case when product.id is not null then jsonb_build_object('id', product.id, 'name', product.name) end)
    || case when target.product_seq is not null then jsonb_build_object('prdId', public.prd_id_of(target.product_id, target.product_seq)) else '{}'::jsonb end;
end;
$$;

-- ── Approving, by either key ─────────────────────────────────────────────────────

-- As 20261129110000_product_lookups.sql: a product PRD is numbered, and its answer carries prdId.
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
  label   text;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target from public.dossiers d where d.id = p_dossier for share;
  if not found then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  select p.* into product from public.products p where p.id = target.product_id;
  if not public.is_member(target.workspace_id) then
    raise exception 'Only a member of the workspace that owns % approves its PRDs.', coalesce(target.home_repo, product.name, 'this PRD')
      using errcode = '42501';
  end if;
  if product.id is not null
     and exists (select 1 from public.product_approvers a where a.product_id = product.id and a.state = 'asked')
     and not exists (select 1 from public.product_approvers a
                      where a.product_id = product.id and a.user_id = caller and a.state = 'asked') then
    raise exception 'Only %''s approvers approve its PRDs: a workspace owner lists them on Settings › Products.', product.name
      using errcode = '42501';
  end if;
  if target.kind <> 'prd' or (target.prd is null and target.product_seq is null) then
    raise exception 'Only a numbered PRD is approved: number it with its first push.' using errcode = '22023';
  end if;
  label := coalesce(public.prd_id_of(target.product_id, target.product_seq), '#' || target.prd);
  if target.birthplace is distinct from 'server' then
    raise exception 'PRD % was born in the repository: its phase-0 pull request approves it.', label using errcode = '22023';
  end if;
  select array_agg(k order by o) into missing
    from unnest(array['spec', 'plan', 'before-after']) with ordinality as w (k, o)
   where not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id and v.kind = w.k);
  if missing is not null then
    raise exception 'PRD % has no % yet: push it first.', label, array_to_string(missing, ', ') using errcode = '22023';
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

  return jsonb_build_object('id', made, 'repo', target.home_repo, 'prd', target.prd)
    || case when target.product_seq is not null then jsonb_build_object('prdId', public.prd_id_of(target.product_id, target.product_seq)) else '{}'::jsonb end;
end;
$$;

-- As 20261126090000_approval_voiding.sql, finding the PRD by either key (prd_dossier()).
drop function public.dossier_approval(text, integer);
create function public.dossier_approval(p_repo text, p_prd integer, p_product text default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.dossiers%rowtype;
  latest public.approvals%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  target := public.prd_dossier(p_repo, p_prd, p_product);
  if target.id is null then
    return null;
  end if;
  select a.* into latest
    from public.approvals a
   where a.dossier_id = target.id
   order by a.approved_at desc, a.id desc
   limit 1;
  if not found then
    return jsonb_build_object('dossier', target.id, 'approval', null);
  end if;
  return jsonb_build_object(
    'dossier', target.id,
    'approval', jsonb_build_object(
      'approver', jsonb_build_object(
        'login', latest.approver_login,
        'member', exists (select 1 from public.workspace_members m
                           where m.workspace_id = target.workspace_id and m.user_id = latest.approved_by)),
      'approvedAt', latest.approved_at,
      'files', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'kind', f.value ->> 'kind',
                 'path', f.value ->> 'path',
                 'sha256', f.value ->> 'sha256',
                 'versionId', f.value ->> 'version_id',
                 'content', v.content) order by f.o), '[]'::jsonb)
          from jsonb_array_elements(latest.files) with ordinality as f (value, o)
          left join public.dossier_versions v on v.id = (f.value ->> 'version_id')::uuid),
      'voids', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'pusher', x.pusher_login,
                 'kind', x.kind,
                 'from', x.from_sha256,
                 'to', x.to_sha256,
                 'voidedAt', x.voided_at) order by x.voided_at, x.id), '[]'::jsonb)
          from public.approval_voids x
         where x.approval_id = latest.id)));
end;
$$;

-- As 20261129110000_product_lookups.sql, finding the PRD by either key (prd_dossier()); a product
-- PRD's answer carries prdId.
drop function public.approval_request(text, integer);
create function public.approval_request(p_repo text, p_prd integer, p_product text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller      uuid := (select auth.uid());
  target      public.dossiers%rowtype;
  product     public.products%rowtype;
  has_product boolean;
  author      uuid;
  chosen      uuid[];
  nobody      boolean;
  made        public.approval_requests%rowtype;
  label       text;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  target := public.prd_dossier(p_repo, p_prd, p_product);
  if target.id is null then
    if nullif(btrim(coalesce(p_product, '')), '') is not null then
      raise exception 'No dossier for PRD %-%.', btrim(p_product), p_prd using errcode = 'P0002';
    end if;
    raise exception 'No dossier for PRD #% of %.', p_prd, p_repo using errcode = 'P0002';
  end if;
  label := coalesce(public.prd_id_of(target.product_id, target.product_seq), '#' || target.prd);
  if target.birthplace is distinct from 'server' then
    raise exception 'PRD % was born in the repository: its phase-0 pull request approves it.', label using errcode = '22023';
  end if;
  select p.* into product from public.products p where p.id = target.product_id;
  has_product := found;
  -- A dossier the fallback opened names no author: the person asking stands in.
  author := coalesce(target.opened_by, caller);

  select coalesce(array_agg(a.user_id order by a.set_at, a.user_id), '{}') into chosen
    from public.product_approvers a
   where has_product and a.product_id = product.id and a.state = 'asked' and a.user_id <> author;
  nobody := cardinality(chosen) = 0;
  if nobody then
    chosen := array[author];
  end if;

  insert into public.approval_requests (dossier_id, workspace_id, product_id, asked_by, asked, nobody_else, kind)
  values (target.id, target.workspace_id, case when has_product then product.id end, caller, chosen, nobody,
          case when exists (select 1 from public.approval_requests r where r.dossier_id = target.id) then 're-asked' else 'asked' end)
  returning * into made;

  return jsonb_build_object(
    'id', made.id,
    'dossier', target.id,
    'repo', target.home_repo,
    'prd', target.prd,
    'title', target.title,
    'kind', made.kind,
    'askedAt', made.asked_at,
    'product', case when has_product then product.name end,
    'author', public.member_login(target.workspace_id, author),
    'nobodyElse', nobody,
    'asked', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user', u.id,
               'login', public.member_login(target.workspace_id, u.id),
               'name', nullif(btrim(pl.display_name), '')) order by u.o), '[]'::jsonb)
        from unnest(chosen) with ordinality as u (id, o)
        left join public.players pl on pl.workspace_id = target.workspace_id and pl.user_id = u.id),
    'files', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'sha256', l.sha256) order by l.o), '[]'::jsonb)
        from (
          select distinct on (v.kind) v.kind, v.sha256, k.o
            from public.dossier_versions v
            join unnest(array['spec', 'plan', 'before-after', 'voice']) with ordinality as k (kind, o) on k.kind = v.kind
           where v.dossier_id = target.id
           order by v.kind, v.created_at desc, v.id desc
        ) l),
    'spec', (
      select v.content from public.dossier_versions v
       where v.dossier_id = target.id and v.kind = 'spec'
       order by v.created_at desc, v.id desc
       limit 1))
    || case when target.product_seq is not null then jsonb_build_object('prdId', public.prd_id_of(target.product_id, target.product_seq)) else '{}'::jsonb end;
end;
$$;

-- ── Who runs what ────────────────────────────────────────────────────────────────

revoke execute on function public.products_key_once() from public, anon, authenticated;
revoke execute on function public.dossiers_product_prd_fixed() from public, anon, authenticated;
revoke execute on function public.prd_id_of(uuid, integer) from public, anon, authenticated;
revoke execute on function public.product_of_key(text, text) from public, anon, authenticated;
revoke execute on function public.prd_dossier(text, integer, text) from public, anon, authenticated;
revoke execute on function public.product_prd_ids_rollback_guard() from public, anon, authenticated;
revoke execute on function public.product_set_key(uuid, text) from public, anon;
grant execute on function public.product_set_key(uuid, text) to authenticated;
revoke execute on function public.dossier_push(text, integer, text, uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.dossier_push(text, integer, text, uuid, jsonb, text, text, text) to authenticated;
revoke execute on function public.dossier_approval(text, integer, text) from public, anon;
grant execute on function public.dossier_approval(text, integer, text) to authenticated;
revoke execute on function public.approval_request(text, integer, text) from public, anon;
grant execute on function public.approval_request(text, integer, text) to authenticated;
