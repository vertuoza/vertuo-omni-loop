-- A PRD's and an idea's product, optional (PRD 1364 s2, docs:
-- .omni-loop/delivery/inbox/1364-product-home/spec.md §2).
--
-- - dossiers.product_id and ideas.product_id: nullable, each with a composite FK to
--   products (id, workspace_id) that goes null when the product is deleted.
-- - Birth. A dossier's first version gives it its repository's product when the repository is in one
--   product, and none when it is in none or in several (dossier_versions_product). dossier_push() takes
--   a new p_product: on a dossier's first push, in a repository of several products, the one of them it
--   names (by name, any case) is the dossier's product; a name it is not in leaves none. A later push
--   never changes it. Its answer carries the dossier's product, {id, name} or null. An idea takes its
--   repository's only product when it is created, never asking (ideas_birth_product).
-- - dossier_set_product(): any member of the dossier's workspace changes its product, to one of the
--   workspace's or to none; refused with `product is locked: PRD <n> is approved` (55000) while an
--   approval is in force, that is, its latest approval has no void. A member changes an idea's product
--   directly (a column grant), within the workspace by the FK, with no lock.
-- - The link. A dossier with a product links its home repository and every repository its latest plan's
--   `## Repositories` table names (as owner/name, or by the name alone among the workspace's
--   repositories) to that product, added_by = prd, each time its product is given and on each version
--   added: a link that exists is left as it is, and a repository the workspace does not list is skipped.
-- - Existing dossiers and ideas take their repository's only product, by the same rule as a birth.
--
-- Proven by supabase/checks/prd_product.sql.
--
-- Rollback: a follow-up migration restores dossier_push() of 20261126090000_approval_voiding.sql, drops
-- dossier_set_product(), the two triggers and their functions, dossier_link_repositories(),
-- plan_repository_names() and repository_only_product(), and drops ideas.product_id and
-- dossiers.product_id. The links added by a PRD stay; delete those with added_by = 'prd' to undo them.

-- ── The columns ──────────────────────────────────────────────────────────────────

alter table public.dossiers
  add column product_id uuid,
  add foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete set null (product_id);
alter table public.ideas
  add column product_id uuid,
  add foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete set null (product_id);

create index dossiers_product_idx on public.dossiers (product_id) where product_id is not null;
create index ideas_product_idx on public.ideas (product_id) where product_id is not null;

comment on column public.dossiers.product_id is
  'PRD 1364: the product this dossier is for, or null. Set at its first push (its repository''s only product, or the one the push names among several), changed through dossier_set_product() until an approval is in force.';
comment on column public.ideas.product_id is
  'PRD 1364: the product this idea is for, or null. Its repository''s only product when it is created; a member changes it.';

grant select (product_id) on public.dossiers to authenticated;
grant update (product_id) on public.ideas to authenticated;

-- ── The rule ─────────────────────────────────────────────────────────────────────

-- The repository's product when it is in exactly one, else null.
create function public.repository_only_product(p_workspace uuid, p_repo text) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then min(l.product_id::text)::uuid end
    from public.product_repositories l
   where l.workspace_id = p_workspace and l.repository = p_repo
$$;

-- The `repo` cells of the first table under a plan's `## Repositories` heading, as written (backticks
-- and spaces taken off, lower case), in order; {} without the heading or the table. As the kit's
-- parsePlanRepositories() reads it.
create function public.plan_repository_names(p_plan text) returns text[]
language plpgsql immutable
set search_path = ''
as $$
declare
  line    text;
  inside  boolean := false;
  header  text[];
  col     integer;
  cells   text[];
  cell    text;
  names   text[] := '{}';
begin
  foreach line in array regexp_split_to_array(coalesce(p_plan, ''), E'\r?\n') loop
    line := btrim(line);
    if not inside then
      inside := line ~* '^##\s+repositories\s*$';
      continue;
    end if;
    if line ~ '^#{1,2}\s' then
      exit;
    end if;
    if left(line, 1) <> '|' then
      exit when header is not null;
      continue;
    end if;
    cells := string_to_array(regexp_replace(regexp_replace(line, '^\|', ''), '\|$', ''), '|');
    if header is null then
      select array_agg(lower(btrim(c)) order by o) into header from unnest(cells) with ordinality as h (c, o);
      col := array_position(header, 'repo');
      exit when col is null;
      continue;
    end if;
    if array_to_string(cells, '') ~ '^[\s:-]*$' then
      continue;
    end if;
    cell := lower(btrim(replace(coalesce(cells[col], ''), '`', '')));
    if cell <> '' and cell !~ '^[—–-]+$' then
      names := names || cell;
    end if;
  end loop;
  return names;
end;
$$;

-- Links the dossier's home repository, and every repository its latest plan's Repositories table names,
-- to its product (added_by = prd). A link that exists is left as it is; a repository the workspace does
-- not list is skipped; a dossier with no product links nothing. A name with no owner is the workspace's
-- repository of that name under the home repository's owner, else its only repository of that name.
create function public.dossier_link_repositories(p_dossier uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.dossiers;
  v_plan  text;
  v_owner text;
  v_repos text[];
  v_name  text;
  v_found text;
begin
  select d.* into target from public.dossiers d where d.id = p_dossier;
  if target.id is null or target.product_id is null then
    return;
  end if;
  v_owner := split_part(target.home_repo, '/', 1);
  v_repos := array[target.home_repo];
  select v.content into v_plan
    from public.dossier_versions v
   where v.dossier_id = target.id and v.kind = 'plan'
   order by v.created_at desc, v.id desc
   limit 1;
  foreach v_name in array public.plan_repository_names(v_plan) loop
    v_found := null;
    if position('/' in v_name) > 0 then
      v_found := v_name;
    else
      select r.full_name into v_found from public.repositories r
       where r.workspace_id = target.workspace_id and r.full_name = v_owner || '/' || v_name;
      if v_found is null then
        select min(r.full_name) into v_found from public.repositories r
         where r.workspace_id = target.workspace_id and split_part(r.full_name, '/', 2) = v_name
        having count(*) = 1;
      end if;
    end if;
    if v_found is not null then
      v_repos := v_repos || v_found;
    end if;
  end loop;

  insert into public.product_repositories (product_id, workspace_id, repository, added_by)
  select distinct target.product_id, target.workspace_id, r.full_name, 'prd'
    from public.repositories r
   where r.workspace_id = target.workspace_id and r.full_name = any (v_repos)
  on conflict (product_id, repository) do nothing;
end;
$$;

-- On each version added: a dossier born with no product takes its repository's only one, and a dossier
-- with a product links its repositories to it.
create function public.dossier_versions_product() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.dossiers;
begin
  select d.* into target from public.dossiers d where d.id = new.dossier_id;
  if target.product_id is null
     and not exists (select 1 from public.dossier_versions v where v.dossier_id = new.dossier_id and v.id <> new.id) then
    update public.dossiers d
       set product_id = public.repository_only_product(target.workspace_id, target.home_repo)
     where d.id = target.id;
  end if;
  perform public.dossier_link_repositories(new.dossier_id);
  return null;
end;
$$;

create trigger dossier_versions_product after insert on public.dossier_versions
  for each row execute function public.dossier_versions_product();

-- An idea created with no product takes its repository's only one.
create function public.ideas_birth_product() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_id is null then
    new.product_id := public.repository_only_product(new.workspace_id, new.repo);
  end if;
  return new;
end;
$$;

create trigger ideas_birth_product before insert on public.ideas
  for each row execute function public.ideas_birth_product();

-- ── Changing a dossier's product ─────────────────────────────────────────────────

-- Sets the dossier's product to `p_product`, one of its workspace's, or to none (null), and links its
-- repositories to it. Answers {id, product: {id, name} | null}. 42501 signed out; P0002 a dossier the
-- caller reads no such, or a product not of its workspace; 55000 `product is locked: PRD <n> is
-- approved` while an approval is in force and the product would change.
create function public.dossier_set_product(p_dossier uuid, p_product uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target  public.dossiers;
  product public.products;
  latest  uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target from public.dossiers d
   where d.id = p_dossier and public.is_member(d.workspace_id)
     for update;
  if target.id is null then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  if p_product is not null then
    select p.* into product from public.products p where p.id = p_product and p.workspace_id = target.workspace_id;
    if product.id is null then
      raise exception 'Product: no such product in this workspace.' using errcode = 'P0002', hint = 'product';
    end if;
  end if;
  if target.product_id is distinct from p_product then
    select a.id into latest from public.approvals a
     where a.dossier_id = target.id
     order by a.approved_at desc, a.id desc
     limit 1;
    if latest is not null and not exists (select 1 from public.approval_voids x where x.approval_id = latest) then
      raise exception 'product is locked: PRD % is approved', target.prd using errcode = '55000', hint = 'product';
    end if;
    update public.dossiers d set product_id = p_product where d.id = target.id;
    perform public.dossier_link_repositories(target.id);
  end if;
  return jsonb_build_object('id', target.id,
    'product', case when product.id is not null then jsonb_build_object('id', product.id, 'name', product.name) end);
end;
$$;

-- ── The kit's push, naming a product ─────────────────────────────────────────────

drop function public.dossier_push(text, integer, text, uuid, jsonb, text);

-- As 20261126090000_approval_voiding.sql, with p_product: on the dossier's first push, in a repository of
-- several products, the one of them it names is its product. The answer carries the dossier's product.
create function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb, p_kind text default 'prd', p_product text default null)
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
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
    raise exception 'A push names its repository as owner/name.' using errcode = '22023';
  end if;
  if p_prd is null or p_prd <= 0 then
    raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
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

  if p_draft is not null then
    if v_kind <> 'prd' then
      raise exception 'A % dossier has no draft: push it by its number alone.', v_kind using errcode = '22023';
    end if;
    select d.* into draft from public.dossiers d
     where d.id = p_draft and public.is_member(d.workspace_id)
       for update;
    if not found then
      raise exception 'No such draft dossier.' using errcode = 'P0002';
    end if;
    if draft.home_repo <> v_repo then
      raise exception 'This draft belongs to %.', draft.home_repo using errcode = '22023';
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
  -- none, is the first version's to give (dossier_versions_product).
  if v_product <> '' and target.product_id is null
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

  select p.* into product
    from public.dossiers d join public.products p on p.id = d.product_id
   where d.id = target.id;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged,
    'product', case when product.id is not null then jsonb_build_object('id', product.id, 'name', product.name) end);
end;
$$;

-- ── What was there before ────────────────────────────────────────────────────────

update public.dossiers d
   set product_id = public.repository_only_product(d.workspace_id, d.home_repo)
 where d.product_id is null;
update public.ideas i
   set product_id = public.repository_only_product(i.workspace_id, i.repo)
 where i.product_id is null;

-- ── Who runs what ────────────────────────────────────────────────────────────────

revoke execute on function public.repository_only_product(uuid, text) from public, anon, authenticated;
revoke execute on function public.plan_repository_names(text) from public, anon, authenticated;
revoke execute on function public.dossier_link_repositories(uuid) from public, anon, authenticated;
revoke execute on function public.dossier_versions_product() from public, anon, authenticated;
revoke execute on function public.ideas_birth_product() from public, anon, authenticated;
revoke execute on function public.dossier_set_product(uuid, uuid) from public, anon;
revoke execute on function public.dossier_push(text, integer, text, uuid, jsonb, text, text) from public, anon;
grant execute on function public.dossier_set_product(uuid, uuid) to authenticated;
grant execute on function public.dossier_push(text, integer, text, uuid, jsonb, text, text) to authenticated;
