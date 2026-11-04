-- A Tech Approval before the product approval (PRD 2608 s1, docs:
-- .omni-loop/delivery/inbox/2608-tech-approval/spec.md §2 and §3).
--
-- - approvals.approval_kind and approval_requests.approval_kind: `product` or `tech`, required, `product`
--   by default, so every row already there reads `product`. (approval_requests.kind already means asked or
--   re-asked.) A tech approval pins the same files as a product one, and stays append-only.
-- - dossier_request_tech_approval(dossier, login): the author of a numbered ◆ PRD of one repository names
--   one other member of its workspace, once, before the PRD is approved. Nobody withdraws it (the table is
--   append-only) and the author never changes the named person; a workspace owner names another member
--   only once the named one left the workspace. A ◇ PRD, a product PRD and a roadmap are refused.
-- - dossier_approve(dossier, kind default 'product'): replaces dossier_approve(dossier), so an older caller
--   still gets a product approval. `tech` is given by the request's named person only. A product approval
--   is refused while a requested tech approval is not in force (missing, or voided), naming who it waits on.
-- - approval_in_force(dossier, kind) and tech_approval_state(dossier): the reads the functions below share,
--   for the database's own functions only.
--
-- Every function that reads the approvals table, and what it reads now:
-- - dossier_approval(): the product approval in force, as before; it gains `tech`: {login, state}, state
--   `asked`, `approved` or `voided`, only when the PRD holds a tech request. A tech approval alone reads
--   as `approval: null`.
-- - dossier_approve(): the tech approval in force, by name, before a product approval.
-- - dossier_push(): voids the product approval in force and the tech approval in force, each on its own.
-- - roadmap_product_push(): the product approval in force (a roadmap has no other kind).
-- - dossier_set_product(): the product approval in force locks the product.
-- - approval_requests_waiting(): a product request until a product approval since; a tech request until a
--   tech approval since is in force, so a voided one shows again; each entry carries `approvalKind`.
-- - approval_request(): asks again (`re-asked`) after an earlier product request only.
-- - approval_voids_of_push(), approval_void_recipients(): the approval a void names, by its id, whichever
--   its kind, so a voided tech approval's approver is told too; approval_voids_of_push() names the kind.
-- - approval_recipients(), approval_people(): a request by its id, or every request's people, of either kind.
-- - The App's approved check (apps/omni-app/src/approved-check/record.ts) reads a product PRD's latest
--   approval, and a product PRD never takes a tech request.
--
-- Proven by supabase/checks/tech_approval.sql.
--
-- Rollback: a follow-up migration restores dossier_approve(uuid), dossier_approval(), dossier_push(),
-- roadmap_product_push(), dossier_set_product(), approval_requests_waiting(), approval_request() and
-- approval_voids_of_push() of their earlier migrations, drops dossier_request_tech_approval(),
-- approval_in_force(), tech_approval_state() and both approval_kind columns, and refuses while a tech
-- approval or a tech request exists. Until then a PRD with no tech request reads exactly as before.

-- ── The two kinds ────────────────────────────────────────────────────────────────

alter table public.approvals
  add column approval_kind text not null default 'product' check (approval_kind in ('product', 'tech'));
alter table public.approval_requests
  add column approval_kind text not null default 'product' check (approval_kind in ('product', 'tech'));

comment on column public.approvals.approval_kind is
  'PRD 2608: product, the product''s approvers'' approval; tech, the Tech Approval of the person a tech request named. A read of the approval in force names its kind.';
comment on column public.approval_requests.approval_kind is
  'PRD 2608: product, asking the product''s approvers; tech, the PRD''s author naming one member for its Tech Approval (asked holds that one person).';

create index approvals_kind_in_force_idx on public.approvals (dossier_id, approval_kind, approved_at desc, id desc);
create index approval_requests_kind_idx on public.approval_requests (dossier_id, approval_kind, asked_at desc, id desc);

-- ── The shared reads ─────────────────────────────────────────────────────────────

-- The approval of kind `p_kind` in force on dossier `p_dossier`: its latest of that kind, unless a void
-- follows it; a row of nulls when none is.
create function public.approval_in_force(p_dossier uuid, p_kind text) returns public.approvals
language sql stable
security definer
set search_path = ''
as $$
  select l.*
    from (select a.* from public.approvals a
           where a.dossier_id = p_dossier and a.approval_kind = p_kind
           order by a.approved_at desc, a.id desc
           limit 1) l
   where not exists (select 1 from public.approval_voids x where x.approval_id = l.id)
$$;

-- The tech request of dossier `p_dossier` as a reader sees it: {login, state}, `login` the person its
-- latest tech request names, `state` approved (a tech approval since it is in force), voided (one since was
-- voided) or asked; null when the dossier holds no tech request.
create function public.tech_approval_state(p_dossier uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'login', public.member_login(r.workspace_id, r.asked[1]),
           'state', case when t.id is null then 'asked'
                         when exists (select 1 from public.approval_voids x where x.approval_id = t.id) then 'voided'
                         else 'approved' end)
    from (select q.* from public.approval_requests q
           where q.dossier_id = p_dossier and q.approval_kind = 'tech'
           order by q.asked_at desc, q.id desc
           limit 1) r
    left join lateral (
      select a.id from public.approvals a
       where a.dossier_id = p_dossier and a.approval_kind = 'tech' and a.approved_at >= r.asked_at
       order by a.approved_at desc, a.id desc
       limit 1) t on true
$$;

-- ── Requesting a Tech Approval ───────────────────────────────────────────────────

-- The caller, the author of numbered ◆ PRD `p_dossier` (its opener, or the caller when none is recorded),
-- names `p_login`, another member of its workspace, for its Tech Approval: once, before the PRD is approved.
-- A workspace owner names another member once the person named left the workspace. Answers
-- {id, dossier, repo, prd, title, kind, approvalKind, askedAt, author, asked: [{user, login, name}]},
-- `kind` asked, or re-asked for an owner's rename. 42501 signed out, not a member, not the author, or not
-- an owner renaming; P0002 no such dossier; 22023 any other refusal.
create function public.dossier_request_tech_approval(p_dossier uuid, p_login text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  target  public.dossiers%rowtype;
  wanted  text := lower(btrim(ltrim(btrim(coalesce(p_login, '')), '@')));
  author  uuid;
  named   uuid;
  earlier public.approval_requests%rowtype;
  renamed boolean := false;
  made    public.approval_requests%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target from public.dossiers d where d.id = p_dossier for update;
  if not found then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  if not public.is_member(target.workspace_id) then
    raise exception 'Only a member of the workspace that owns % requests a Tech Approval of its PRDs.', coalesce(target.home_repo, 'this PRD')
      using errcode = '42501';
  end if;
  if target.kind = 'roadmap' then
    raise exception 'A roadmap takes no Tech Approval: only a PRD of one repository does.' using errcode = '22023';
  end if;
  if target.kind <> 'prd' or target.home_repo is null or target.product_seq is not null then
    raise exception 'Only a PRD of one repository takes a Tech Approval: a product PRD does not.' using errcode = '22023';
  end if;
  if target.prd is null then
    raise exception 'Only a numbered PRD takes a Tech Approval: number it with its first push.' using errcode = '22023';
  end if;
  if target.birthplace is distinct from 'server' then
    raise exception 'PRD #% was born in the repository: its phase-0 pull request approves it, with no Tech Approval.', target.prd
      using errcode = '22023';
  end if;
  author := coalesce(target.opened_by, caller);

  select r.* into earlier from public.approval_requests r
   where r.dossier_id = target.id and r.approval_kind = 'tech'
   order by r.asked_at desc, r.id desc
   limit 1;
  if earlier.id is not null then
    if exists (select 1 from public.workspace_members m
                where m.workspace_id = target.workspace_id and m.user_id = earlier.asked[1]) then
      raise exception 'PRD #% already waits for %''s Tech Approval: nobody withdraws it or names another person.',
        target.prd, public.member_login(target.workspace_id, earlier.asked[1]) using errcode = '22023';
    end if;
    if not public.is_owner(target.workspace_id) then
      if caller = author then
        raise exception 'PRD #%''s Tech Approval named %, who left the workspace: only a workspace owner names another person.',
          target.prd, public.member_login(target.workspace_id, earlier.asked[1]) using errcode = '22023';
      end if;
      raise exception 'Only a workspace owner names another person for PRD #%''s Tech Approval.', target.prd using errcode = '42501';
    end if;
    if (public.tech_approval_state(target.id) ->> 'state') = 'approved' then
      raise exception 'PRD #%''s Tech Approval is already given.', target.prd using errcode = '22023';
    end if;
    renamed := true;
  elsif caller <> author then
    raise exception 'Only the author of PRD #% requests its Tech Approval.', target.prd using errcode = '42501';
  end if;
  if (public.approval_in_force(target.id, 'product')).id is not null then
    raise exception 'PRD #% is approved: a Tech Approval is requested before the PRD is approved.', target.prd using errcode = '22023';
  end if;

  if wanted = '' then
    raise exception 'Name the member who gives the Tech Approval, by their login.' using errcode = '22023';
  end if;
  select m.user_id into named
    from public.workspace_members m
   where m.workspace_id = target.workspace_id and public.member_login(target.workspace_id, m.user_id) = wanted
   order by m.joined_at, m.user_id
   limit 1;
  if named is null then
    raise exception 'No member of this workspace is %: name a member by their login.', wanted using errcode = '22023';
  end if;
  if named = author then
    raise exception 'The author of PRD #% never gives its Tech Approval: name another member.', target.prd using errcode = '22023';
  end if;

  insert into public.approval_requests (dossier_id, workspace_id, product_id, asked_by, asked, nobody_else, kind, approval_kind)
  values (target.id, target.workspace_id, target.product_id, caller, array[named], false,
          case when renamed then 're-asked' else 'asked' end, 'tech')
  returning * into made;

  return jsonb_build_object(
    'id', made.id,
    'dossier', target.id,
    'repo', target.home_repo,
    'prd', target.prd,
    'title', target.title,
    'kind', made.kind,
    'approvalKind', made.approval_kind,
    'askedAt', made.asked_at,
    'author', public.member_login(target.workspace_id, author),
    'asked', (
      select jsonb_build_array(jsonb_build_object(
               'user', named,
               'login', public.member_login(target.workspace_id, named),
               'name', nullif(btrim(pl.display_name), '')))
        from (select 1) one
        left join public.players pl on pl.workspace_id = target.workspace_id and pl.user_id = named));
end;
$$;

-- ── Approving, of either kind ────────────────────────────────────────────────────

drop function public.dossier_approve(uuid);

-- As 20261210100000_product_roadmaps.sql, with the kind: `product` (the default, what an older caller
-- gets) is refused while a requested tech approval is not in force; `tech` is given by the person the
-- PRD's tech request names, and by nobody else. Answers {id, repo, prd, kind, …}.
create function public.dossier_approve(p_dossier uuid, p_kind text default 'product') returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  v_kind  text := coalesce(p_kind, 'product');
  target  public.dossiers%rowtype;
  product public.products%rowtype;
  missing text[];
  pinned  jsonb;
  login   text;
  made    uuid;
  label   text;
  asked   public.approval_requests%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_kind not in ('product', 'tech') then
    raise exception 'An approval is product or tech.' using errcode = '22023';
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

  select r.* into asked from public.approval_requests r
   where r.dossier_id = target.id and r.approval_kind = 'tech'
   order by r.asked_at desc, r.id desc
   limit 1;
  if v_kind = 'tech' then
    if asked.id is null then
      raise exception 'Nobody requested a Tech Approval of this PRD.' using errcode = '22023';
    end if;
    if caller <> asked.asked[1] then
      raise exception 'Only % gives this PRD''s Tech Approval.', public.member_login(target.workspace_id, asked.asked[1])
        using errcode = '42501';
    end if;
  elsif product.id is not null
     and exists (select 1 from public.product_approvers a where a.product_id = product.id and a.state = 'asked')
     and not exists (select 1 from public.product_approvers a
                      where a.product_id = product.id and a.user_id = caller and a.state = 'asked') then
    raise exception 'Only %''s approvers approve its PRDs: a workspace owner lists them on Settings › Products.', product.name
      using errcode = '42501';
  end if;

  if target.kind = 'roadmap' then
    label := coalesce(public.roadmap_id_of(target.product_id, target.product_seq), 'R' || target.product_seq);
    if not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id and v.kind = 'roadmap') then
      raise exception 'Roadmap % has no roadmap.md yet: push it first.', label using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object('kind', l.kind, 'path', 'roadmap.md', 'sha256', l.sha256, 'version_id', l.id))
      into pinned
      from (
        select v.kind, v.sha256, v.id
          from public.dossier_versions v
         where v.dossier_id = target.id and v.kind = 'roadmap'
         order by v.created_at desc, v.id desc
         limit 1
      ) l;
  else
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
    -- Tech first: a requested Tech Approval holds the product approval until it is in force.
    if v_kind = 'product' and asked.id is not null and (public.approval_in_force(target.id, 'tech')).id is null then
      raise exception 'PRD % waits for %''s Tech Approval first.', label, public.member_login(target.workspace_id, asked.asked[1])
        using errcode = '22023';
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
  end if;

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

  insert into public.approvals (dossier_id, approved_by, approver_login, files, approval_kind)
  values (target.id, caller, left(login, 200), pinned, v_kind)
  returning id into made;

  return jsonb_build_object('id', made, 'repo', target.home_repo, 'prd', target.prd, 'kind', v_kind)
    || case when target.kind = 'roadmap' then jsonb_build_object('roadmap', label)
            when target.product_seq is not null then jsonb_build_object('prdId', public.prd_id_of(target.product_id, target.product_seq))
            else '{}'::jsonb end;
end;
$$;

-- ── What the kit reads ───────────────────────────────────────────────────────────

-- As 20261203100000_product_prd_ids.sql, reading the product approval in force only, and with `tech`
-- ({login, state}) when the PRD holds a tech request.
create or replace function public.dossier_approval(p_repo text, p_prd integer, p_product text default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.dossiers%rowtype;
  latest public.approvals%rowtype;
  tech   jsonb;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  target := public.prd_dossier(p_repo, p_prd, p_product);
  if target.id is null then
    return null;
  end if;
  tech := public.tech_approval_state(target.id);
  select a.* into latest
    from public.approvals a
   where a.dossier_id = target.id and a.approval_kind = 'product'
   order by a.approved_at desc, a.id desc
   limit 1;
  if not found then
    return jsonb_build_object('dossier', target.id, 'approval', null)
      || case when tech is not null then jsonb_build_object('tech', tech) else '{}'::jsonb end;
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
         where x.approval_id = latest.id)))
    || case when tech is not null then jsonb_build_object('tech', tech) else '{}'::jsonb end;
end;
$$;

-- ── The kit's push, voiding both kinds ───────────────────────────────────────────

-- As 20261217100000_archive_product.sql, with the approval in force read per kind: a changed pinned file
-- voids the product approval in force and the tech approval in force, each with its own row.
create or replace function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb, p_kind text default 'prd', p_product text default null, p_product_key text default null)
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
  forces    public.approvals[] := '{}';
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
            join public.products p on p.id = l.product_id
           where l.workspace_id = target.workspace_id and l.repository = target.home_repo and p.archived_at is null) > 1 then
    select l.product_id into named
      from public.product_repositories l
      join public.products p on p.id = l.product_id
     where l.workspace_id = target.workspace_id and l.repository = target.home_repo and lower(p.name) = v_product
       and p.archived_at is null
     limit 1;
    if named is not null then
      update public.dossiers d set product_id = named where d.id = target.id;
    end if;
  end if;

  -- The approvals in force before this push, one per kind: the latest of each, unless a void follows it.
  in_force := public.approval_in_force(target.id, 'product');
  if in_force.id is not null then
    forces := forces || in_force;
  end if;
  in_force := public.approval_in_force(target.id, 'tech');
  if in_force.id is not null then
    forces := forces || in_force;
  end if;

  for item in select value from jsonb_array_elements(p_artifacts) loop
    v_version := public.dossier_add_version(target.id, item ->> 'kind', item ->> 'content', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item ->> 'kind');
    else
      added := added || jsonb_build_object('kind', item ->> 'kind', 'version', v_version);
      foreach in_force in array forces loop
        pinned := null;
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
      end loop;
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

-- ── A roadmap's push, reading the product approval ───────────────────────────────

-- As 20261210100000_product_roadmaps.sql, with the approval in force read as the product one: a roadmap
-- takes no other kind.
create or replace function public.roadmap_product_push(p_key text, p_roadmap integer, p_body jsonb, p_repo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  body      jsonb := coalesce(p_body, '{}'::jsonb);
  v_key     text := btrim(coalesce(p_key, ''));
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_result  jsonb;
  v_seq     integer;
  v_version integer;
  keyed     public.products%rowtype;
  target    public.dossiers%rowtype;
  v_roadmap public.roadmaps%rowtype;
  v_created boolean;
  item      record;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
  in_force  public.approvals%rowtype;
  pinned    text;
  latest    public.dossier_versions%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if jsonb_typeof(body) <> 'object' then
    raise exception 'A push carries its fields as an object.' using errcode = '22023';
  end if;
  if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
    raise exception 'A product key is lowercase kebab-case, as mobile.' using errcode = '22023';
  end if;
  if v_repo <> '' and (v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200) then
    raise exception 'A push names its repository as owner/name.' using errcode = '22023';
  end if;
  if p_roadmap is not null and p_roadmap <= 0 then
    raise exception 'A roadmap number is a positive whole number.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'document') is distinct from 'string' then
    raise exception 'A roadmap carries its document.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'prds') is distinct from 'array' or jsonb_typeof(body -> 'questions') is distinct from 'array' then
    raise exception 'A roadmap carries its PRDs and its questions.' using errcode = '22023';
  end if;
  if jsonb_array_length(body -> 'prds') > 200 then
    raise exception 'A roadmap holds 200 PRDs at most.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'humanWork') not in ('array', 'null') then
    raise exception 'A roadmap carries its human work as a list.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'humanWork') = 'array' then
    if jsonb_array_length(body -> 'humanWork') > 500 then
      raise exception 'A roadmap holds 500 pieces of human work at most.' using errcode = '22023';
    end if;
    if (select count(distinct e.value ->> 'key') from jsonb_array_elements(body -> 'humanWork') as e (value))
       <> jsonb_array_length(body -> 'humanWork') then
      raise exception 'A key of human work is used twice, or missing.' using errcode = '22023';
    end if;
  end if;
  if jsonb_typeof(body -> 'prerequisites') not in ('array', 'null') then
    raise exception 'A push carries its prerequisites as a list.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'prerequisites') = 'array' and jsonb_array_length(body -> 'prerequisites') > 100 then
    raise exception 'A roadmap holds 100 prerequisites at most.' using errcode = '22023';
  end if;
  v_result := case when jsonb_typeof(body -> 'prerequisiteResult') = 'object' then body -> 'prerequisiteResult' end;
  if v_result is not null and jsonb_typeof(v_result -> 'rows') is distinct from 'array' then
    raise exception 'A prerequisites result carries its rows.' using errcode = '22023';
  end if;

  keyed := public.product_of_key(v_key, v_repo);
  if keyed.id is null then
    raise exception 'No product keyed % in your workspaces.', v_key using errcode = 'P0002';
  end if;

  if p_roadmap is null then
    -- The product's row is locked until this push commits: the next create waits, then takes the next
    -- number. A push rolled back takes its number back with it.
    update public.products p set roadmap_seq = p.roadmap_seq + 1 where p.id = keyed.id returning p.roadmap_seq into v_seq;
    insert into public.dossiers (workspace_id, home_repo, kind, product_id, product_seq, title, opened_by, numbered_at, birthplace)
    values (keyed.workspace_id, null, 'roadmap', keyed.id, v_seq, btrim(body ->> 'title'), caller, now(), 'server')
    returning * into target;
    insert into public.roadmaps (workspace_id, repo, number, dossier_id, title, milestone, product_id, target_date, source, questions, document, pushed_by)
    values (
      keyed.workspace_id, null, null, target.id, btrim(body ->> 'title'), btrim(body ->> 'milestone'), keyed.id,
      (body ->> 'target')::date, nullif(btrim(body ->> 'source'), ''), body -> 'questions', body ->> 'document', caller
    )
    returning * into v_roadmap;
    v_created := true;
  else
    select d.* into target from public.dossiers d
     where d.product_id = keyed.id and d.kind = 'roadmap' and d.product_seq = p_roadmap
       for update;
    if not found then
      raise exception 'No roadmap %-R% on %.', v_key, p_roadmap, keyed.name using errcode = 'P0002';
    end if;
    update public.dossiers d set title = btrim(body ->> 'title') where d.id = target.id;
    update public.roadmaps r
       set title = btrim(body ->> 'title'), milestone = btrim(body ->> 'milestone'),
           target_date = (body ->> 'target')::date, source = nullif(btrim(body ->> 'source'), ''),
           questions = body -> 'questions', document = body ->> 'document', pushed_by = caller, pushed_at = now()
     where r.dossier_id = target.id
     returning * into v_roadmap;
    delete from public.roadmap_prds where roadmap_id = v_roadmap.id;
    v_created := false;
  end if;

  insert into public.roadmap_prds (roadmap_id, position, row_id, prd_id, title, repos, blockers, wave, state, waits_on, waits_on_url, started_at, ended_at)
  select v_roadmap.id, e.ordinality::integer, e.value ->> 'id', e.value ->> 'prd', btrim(e.value ->> 'title'),
         coalesce(array(select lower(jsonb_array_elements_text(coalesce(e.value -> 'repos', '[]'::jsonb)))), '{}'),
         coalesce(array(select jsonb_array_elements_text(coalesce(e.value -> 'blockers', '[]'::jsonb))), '{}'),
         (e.value ->> 'wave')::integer, e.value ->> 'state', nullif(btrim(e.value ->> 'waitsOn'), ''), e.value ->> 'waitsOnUrl',
         (e.value ->> 'startedAt')::timestamptz, (e.value ->> 'endedAt')::timestamptz
    from jsonb_array_elements(body -> 'prds') with ordinality as e (value, ordinality);

  -- Its human work, as roadmap_push() keeps it; a product PRD's work keeps its id in its key, its number null.
  if jsonb_typeof(body -> 'humanWork') = 'array' then
    insert into public.roadmap_human_work (roadmap_id, key, prd, repo, source, text, act, url, kind, kind_by)
    select v_roadmap.id, e.value ->> 'key',
           case when (e.value ->> 'prd') ~ '^[1-9][0-9]{0,8}$' then (e.value ->> 'prd')::integer end,
           lower(btrim(e.value ->> 'repo')), e.value ->> 'source',
           btrim(e.value ->> 'text'), nullif(btrim(e.value ->> 'act'), ''), e.value ->> 'url', e.value ->> 'ruleKind', 'rule'
      from jsonb_array_elements(body -> 'humanWork') as e (value)
    on conflict (roadmap_id, key) do update
       set prd = excluded.prd, repo = excluded.repo, source = excluded.source, text = excluded.text, act = excluded.act,
           url = excluded.url, state = 'open', done_at = null;
    update public.roadmap_human_work h
       set state = 'done', done_at = now()
     where h.roadmap_id = v_roadmap.id and h.state = 'open'
       and not exists (select 1 from jsonb_array_elements(body -> 'humanWork') as e (value) where e.value ->> 'key' = h.key);
  end if;

  -- Its prerequisites, as roadmap_prerequisites_push() replaces them.
  if jsonb_typeof(body -> 'prerequisites') = 'array' then
    delete from public.roadmap_prerequisites where roadmap_id = v_roadmap.id;
    insert into public.roadmap_prerequisites (roadmap_id, position, row_id, category, need, check_with, fix_with, blocks_all, blocks, who, repos, card, state, detail)
    select v_roadmap.id, e.ordinality::integer, e.value ->> 'id', e.value ->> 'category', btrim(e.value ->> 'need'),
           nullif(btrim(e.value ->> 'check'), ''), nullif(btrim(e.value ->> 'fix'), ''),
           jsonb_typeof(e.value -> 'blocks') = 'string' and e.value ->> 'blocks' = 'all',
           case when jsonb_typeof(e.value -> 'blocks') = 'array'
                then coalesce(array(select jsonb_array_elements_text(e.value -> 'blocks')), '{}') else '{}' end,
           e.value ->> 'who',
           coalesce(array(select lower(jsonb_array_elements_text(coalesce(e.value -> 'repos', '[]'::jsonb)))), '{}'),
           case when jsonb_typeof(e.value -> 'card') = 'object' then e.value -> 'card' end,
           found_row.value ->> 'state',
           case when found_row.value ->> 'state' = 'waits' then left(nullif(btrim(found_row.value ->> 'detail'), ''), 500) end
      from jsonb_array_elements(body -> 'prerequisites') with ordinality as e (value, ordinality)
      left join lateral (
        select r.value from jsonb_array_elements(coalesce(v_result -> 'rows', '[]'::jsonb)) as r (value)
         where r.value ->> 'id' = e.value ->> 'id' limit 1
      ) as found_row on true;
    update public.roadmaps r
       set prerequisites_machine = nullif(btrim(v_result ->> 'machine'), ''),
           prerequisites_checked_at = (v_result ->> 'checkedAt')::timestamptz
     where r.id = v_roadmap.id;
  end if;

  -- The approval in force before this push: the latest product approval, unless a void follows it.
  in_force := public.approval_in_force(target.id, 'product');

  -- A version of each part the push carries, added only when it changed.
  for item in
    select v.kind, v.content
      from (values
              (1, 'roadmap', body ->> 'document'),
              (2, 'roadmap-prds', (body -> 'prds')::text),
              (3, 'roadmap-human-work', case when jsonb_typeof(body -> 'humanWork') = 'array' then (body -> 'humanWork')::text end),
              (4, 'roadmap-prerequisites', case when jsonb_typeof(body -> 'prerequisites') = 'array' then (body -> 'prerequisites')::text end)
           ) as v (o, kind, content)
     where v.content is not null
     order by v.o
  loop
    v_version := public.dossier_add_version(target.id, item.kind, item.content, 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item.kind);
    else
      added := added || jsonb_build_object('kind', item.kind, 'version', v_version);
      if in_force.id is not null then
        select f.value ->> 'sha256' into pinned
          from jsonb_array_elements(in_force.files) f
         where f.value ->> 'kind' = item.kind
         limit 1;
        if pinned is not null then
          select v.* into latest
            from public.dossier_versions v
           where v.dossier_id = target.id and v.kind = item.kind
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

  return jsonb_build_object(
    'roadmapId', v_roadmap.id,
    'dossierId', target.id,
    'roadmap', public.roadmap_id_of(keyed.id, target.product_seq),
    'created', v_created,
    'product', jsonb_build_object('id', keyed.id, 'name', keyed.name),
    'added', added,
    'unchanged', unchanged
  );
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
    or not_null_violation or check_violation or unique_violation or foreign_key_violation then
    raise exception 'A roadmap''s fields are malformed: %', sqlerrm using errcode = '22023';
end;
$$;

-- ── The product a PRD belongs to, locked by its product approval ─────────────────

-- As 20261217100000_archive_product.sql, the lock read from the product approval in force.
create or replace function public.dossier_set_product(p_dossier uuid, p_product uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target  public.dossiers;
  product public.products;
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
    product := public.product_live(product);
  end if;
  if target.product_id is distinct from p_product then
    if (public.approval_in_force(target.id, 'product')).id is not null then
      raise exception 'product is locked: PRD % is approved', target.prd using errcode = '55000', hint = 'product';
    end if;
    update public.dossiers d set product_id = p_product where d.id = target.id;
    perform public.dossier_link_repositories(target.id);
  end if;
  return jsonb_build_object('id', target.id,
    'product', case when product.id is not null then jsonb_build_object('id', product.id, 'name', product.name) end);
end;
$$;

-- ── Asking the product's approvers ───────────────────────────────────────────────

-- As 20261203100000_product_prd_ids.sql, a product request: `re-asked` after an earlier product request.
create or replace function public.approval_request(p_repo text, p_prd integer, p_product text default null) returns jsonb
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

  insert into public.approval_requests (dossier_id, workspace_id, product_id, asked_by, asked, nobody_else, kind, approval_kind)
  values (target.id, target.workspace_id, case when has_product then product.id end, caller, chosen, nobody,
          case when exists (select 1 from public.approval_requests r where r.dossier_id = target.id and r.approval_kind = 'product')
               then 're-asked' else 'asked' end,
          'product')
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

-- ── The bell, per kind ───────────────────────────────────────────────────────────

-- As 20261125090000_approval_requests.sql, per kind: of each dossier of the caller's workspaces, its latest
-- product request while no product approval came since, and its latest tech request while no tech approval
-- since is in force (a voided one waits again), when it asks the caller. Oldest first,
-- [{id, dossier, repo, prd, title, askedAt, approvalKind}].
create or replace function public.approval_requests_waiting() returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (r.dossier_id, r.approval_kind) r.*
      from public.approval_requests r
     where public.is_member(r.workspace_id)
     order by r.dossier_id, r.approval_kind, r.asked_at desc, r.id desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'dossier', d.id, 'repo', d.home_repo, 'prd', d.prd, 'title', d.title, 'askedAt', l.asked_at,
           'approvalKind', l.approval_kind)
         order by l.asked_at, l.id), '[]'::jsonb)
    from latest l
    join public.dossiers d on d.id = l.dossier_id
   where (select auth.uid()) = any (l.asked)
     and case l.approval_kind
           when 'product' then not exists (
             select 1 from public.approvals a
              where a.dossier_id = l.dossier_id and a.approval_kind = 'product' and a.approved_at >= l.asked_at)
           else coalesce(public.tech_approval_state(l.dossier_id) ->> 'state', 'asked') <> 'approved'
         end
$$;

-- ── Telling the approvers a push voided ──────────────────────────────────────────

-- As 20261126090000_approval_voiding.sql, each void naming its approval's kind (`approvalKind`).
create or replace function public.approval_voids_of_push(p_dossier uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'dossier', d.id, 'repo', d.home_repo, 'prd', d.prd, 'title', d.title,
           'kind', x.kind, 'from', x.from_sha256, 'to', x.to_sha256,
           'pusher', x.pusher_login, 'approver', a.approver_login, 'approvalKind', a.approval_kind)
         order by x.voided_at, x.id), '[]'::jsonb)
    from public.approval_voids x
    join public.dossiers d on d.id = x.dossier_id
    join public.approvals a on a.id = x.approval_id
   where x.dossier_id = p_dossier
     and x.pushed_by = (select auth.uid())
     and public.is_member(d.workspace_id)
     and x.version_id = (
       select v.id from public.dossier_versions v
        where v.dossier_id = x.dossier_id and v.kind = x.kind
        order by v.created_at desc, v.id desc
        limit 1)
$$;

revoke execute on function public.approval_in_force(uuid, text) from public, anon, authenticated;
revoke execute on function public.tech_approval_state(uuid) from public, anon, authenticated;
revoke execute on function public.dossier_request_tech_approval(uuid, text) from public, anon;
revoke execute on function public.dossier_approve(uuid, text) from public, anon;
grant execute on function public.dossier_request_tech_approval(uuid, text) to authenticated;
grant execute on function public.dossier_approve(uuid, text) to authenticated;
