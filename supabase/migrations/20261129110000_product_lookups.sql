-- Every product lookup resolves PRD, then repository, then none (PRD 1364 s3, docs:
-- .omni-loop/delivery/inbox/1364-product-home/spec.md §3).
--
-- Each lookup that found a product through repositories.product_id now finds it through the PRD it is
-- for, else the repository's links (product_repositories):
--   1. the PRD's own product (dossiers.product_id), when the call names a PRD the server holds: its
--      product, or none when it has none;
--   2. else the repository's only product, when it is linked to exactly one (repository_only_product());
--   3. else none.
-- - business_for_repo(), business_for_token(), constituents_for_repo(), pitch_look_for_repo(),
--   pitch_settings_for_repo() and claim_answer() take an optional p_prd, the PRD number a kit call is
--   for; a call without it reads as before, through the repository. claim_answer() still puts a claim it
--   finds no product for on the business's first product, as it did for a repository in none.
-- - dossier_approve() and approval_request() read the dossier's own product. With none, any member
--   approves and the author alone is asked, as before.
-- - business_for_token() with several products and no repository answers with no product, instead of
--   refusing; a PRD named without its repository is refused (22023).
-- - business_for_repo_app(), constituents_for_repo_app() and agent_question_product() know no PRD: they
--   take the repository's only product.
-- Nothing reads repositories.product_id after this but its writers, which landing 3 drops.
--
-- Proven by supabase/checks/product_lookups.sql.
--
-- Rollback: a follow-up migration drops the p_prd overloads made here, recreates the one-argument
-- business_for_repo(), constituents_for_repo(), pitch_look_for_repo(), pitch_settings_for_repo(), the
-- five-argument claim_answer() and the two-argument business_for_token() as their last migrations define
-- them (20261028090000_agent_tokens.sql, 20261029090000_constituents.sql,
-- 20261101090000_products_pitch_look.sql, 20261107090000_pitch_settings.sql,
-- 20261024090000_customer_voice.sql), and restores business_for_repo_app(), constituents_for_repo_app(),
-- agent_question_product(), dossier_approve() and approval_request() from theirs. No data changes.

-- ── The rule ─────────────────────────────────────────────────────────────────────

-- The product a lookup in `p_repo` for PRD `p_prd` reads: the PRD's own (or none) when the workspace holds
-- that PRD, else the repository's only product, else null.
create function public.lookup_product(p_workspace uuid, p_repo text, p_prd integer default null) returns uuid
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  target public.dossiers;
begin
  if p_workspace is null then
    return null;
  end if;
  if p_prd is not null then
    select d.* into target from public.dossiers d
     where d.workspace_id = p_workspace and d.home_repo = v_repo and d.kind = 'prd' and d.prd = p_prd;
    if target.id is not null then
      return target.product_id;
    end if;
  end if;
  return public.repository_only_product(p_workspace, v_repo);
end;
$$;

comment on function public.lookup_product(uuid, text, integer) is
  'PRD 1364: the product a lookup reads, PRD then repository then none: the PRD''s own product (or none) when the workspace holds it, else the repository''s only product, else null.';

-- ── What a terminal reads, as the caller ─────────────────────────────────────────

drop function public.business_for_repo(text);
create function public.business_for_repo(p_repo text, p_prd integer default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
begin
  return public.business_for_product(ws, public.lookup_product(ws, p_repo, p_prd));
end;
$$;

drop function public.constituents_for_repo(text);
create function public.constituents_for_repo(p_repo text, p_prd integer default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
begin
  return public.constituents_of_product(public.lookup_product(ws, p_repo, p_prd));
end;
$$;

drop function public.pitch_look_for_repo(text);
create function public.pitch_look_for_repo(p_repo text, p_prd integer default null) returns text
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  look text;
begin
  select p.pitch_look into look from public.products p where p.id = public.lookup_product(ws, p_repo, p_prd);
  return coalesce(look, 'arcade');
end;
$$;

drop function public.pitch_settings_for_repo(text);
create function public.pitch_settings_for_repo(p_repo text, p_prd integer default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  found_one jsonb;
begin
  select p.pitch into found_one from public.products p where p.id = public.lookup_product(ws, p_repo, p_prd);
  return coalesce(found_one, '{}'::jsonb);
end;
$$;

-- As 20261024090000_customer_voice.sql, the product found PRD then repository; a claim that needs one
-- and finds none goes on the business's first product, as before.
drop function public.claim_answer(text, text, text, text, text);
create function public.claim_answer(p_repo text, p_kind text, p_value text, p_state text, p_ref text, p_prd integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  biz public.businesses;
  v text;
  v_ref text := btrim(coalesce(p_ref, ''));
  product uuid;
  there public.claims;
  seq_next integer;
  made public.claims;
begin
  perform public.business_member_only(ws);
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival') then
    raise exception 'Kind: region, offering, size, trade or rival.' using errcode = '22023', hint = 'kind';
  end if;
  if p_state is null or p_state not in ('proposed', 'confirmed') then
    raise exception 'State: proposed or confirmed.' using errcode = '22023', hint = 'state';
  end if;
  v := public.business_text(p_value, 'value', 'Value');
  if p_kind = 'size' then
    perform public.business_size_check(v);
  end if;
  if char_length(v_ref) not between 1 and 200 or v_ref ~ '[\r\n]' then
    raise exception 'Ref: the skill and the run, 1 to 200 characters on one line.' using errcode = '22023', hint = 'ref';
  end if;

  perform public.business_open(ws);
  -- The business's row is locked, so two answers never take one number.
  select * into biz from public.businesses b where b.workspace_id = ws for update;
  if p_kind <> 'region' then
    product := coalesce(public.lookup_product(ws, p_repo, p_prd), public.business_first_product(ws));
  end if;

  select * into there from public.claims c
   where c.business_id = biz.id and c.product_id is not distinct from product and c.kind = p_kind and lower(c.value) = lower(v);
  if found then
    if p_state = 'confirmed' and there.state <> 'confirmed' then
      update public.claims c set state = 'confirmed', updated_at = now() where c.id = there.id returning * into there;
    end if;
    return jsonb_build_object('id', there.kind || '#' || there.seq, 'state', there.state, 'added', false);
  end if;

  select coalesce(max(c.seq), 0) + 1 into seq_next from public.claims c where c.business_id = biz.id;
  insert into public.claims (workspace_id, business_id, product_id, seq, kind, value, source, state, receipt, created_by)
  values (ws, biz.id, product, seq_next, p_kind, v, 'answer', p_state, v_ref, auth.uid())
  returning * into made;
  return jsonb_build_object('id', made.kind || '#' || made.seq, 'state', made.state, 'added', true);
end;
$$;

-- ── What an agent's link reads ───────────────────────────────────────────────────

-- As 20261028090000_agent_tokens.sql, with p_prd. Without a repository: the business's only product, and
-- with several, none (it refused before). A PRD named without its repository: 22023.
drop function public.business_for_token(text, text);
create function public.business_for_token(p_hash text, p_repo text default null, p_prd integer default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens := public.agent_token_of(p_hash);
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  org text;
  product uuid;
  products_count integer;
begin
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.agent_tokens x set last_used_at = now() where x.id = t.id;
  end if;

  if v_repo <> '' then
    if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
      raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
    end if;
    select lower(w.github_org) into org from public.workspaces w where w.id = t.workspace_id;
    if not exists (select 1 from public.repositories r where r.workspace_id = t.workspace_id and r.full_name = v_repo)
       and org is distinct from split_part(v_repo, '/', 1) then
      raise exception 'Repository: % is not one of this workspace''s repositories.', v_repo using errcode = '42501', hint = 'repo';
    end if;
    return public.business_for_product(t.workspace_id, public.lookup_product(t.workspace_id, v_repo, p_prd));
  end if;

  if p_prd is not null then
    raise exception 'Repository: a PRD is read in its repository, so name it too.' using errcode = '22023', hint = 'repo';
  end if;
  select count(*), min(p.id::text)::uuid into products_count, product
    from public.products p join public.businesses b on b.id = p.business_id
   where b.workspace_id = t.workspace_id;
  return public.business_for_product(t.workspace_id, case when products_count = 1 then product end);
end;
$$;

-- ── What the App reads, with no PRD: the repository's only product ───────────────

-- As 20261027090000_never_lines.sql, the product found through the repository's links.
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
                                               'claims', '[]'::jsonb, 'personas', '[]'::jsonb, 'updatedAt', null);
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
    'updatedAt', changed);
end;
$$;

-- As 20261029090000_constituents.sql, the product found through the repository's links.
create or replace function public.constituents_for_repo_app(p_repo text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  ws uuid;
begin
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  select r.workspace_id into ws
    from public.repositories r join public.workspaces w on w.id = r.workspace_id
   where r.full_name = v_repo and r.tracked
   order by (lower(w.github_org) is not distinct from split_part(v_repo, '/', 1)) desc, r.added_at, w.slug
   limit 1;
  return public.constituents_of_product(public.repository_only_product(ws, v_repo));
end;
$$;

-- As 20261028100000_agent_questions.sql: the product named, else the repository's only product, else the
-- workspace's only product.
create or replace function public.agent_question_product(q public.agent_questions, p_product uuid) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.products p where p.id = p_product and p.workspace_id = q.workspace_id),
    public.repository_only_product(q.workspace_id, q.repo),
    (select min(p.id::text)::uuid from public.products p where p.workspace_id = q.workspace_id
      having count(*) = 1))
$$;

-- ── Approvals: the PRD's own product ─────────────────────────────────────────────

-- As 20261124090000_product_approvers.sql, the approvers of the dossier's own product.
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
  select p.* into product from public.products p where p.id = target.product_id;
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

-- As 20261125090000_approval_requests.sql, asking the approvers of the dossier's own product.
create or replace function public.approval_request(p_repo text, p_prd integer) returns jsonb
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
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target
    from public.dossiers d
   where d.home_repo = lower(btrim(coalesce(p_repo, ''))) and d.kind = 'prd' and d.prd = p_prd
     and public.is_member(d.workspace_id)
   order by d.numbered_at desc nulls last, d.id
   limit 1;
  if not found then
    raise exception 'No dossier for PRD #% of %.', p_prd, p_repo using errcode = 'P0002';
  end if;
  if target.birthplace is distinct from 'server' then
    raise exception 'PRD #% was born in the repository: its phase-0 pull request approves it.', target.prd using errcode = '22023';
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
       limit 1));
end;
$$;

-- ── Who runs what ────────────────────────────────────────────────────────────────

revoke execute on function public.lookup_product(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.business_for_repo(text, integer) from public, anon;
grant execute on function public.business_for_repo(text, integer) to authenticated;
revoke execute on function public.constituents_for_repo(text, integer) from public, anon;
grant execute on function public.constituents_for_repo(text, integer) to authenticated;
revoke execute on function public.pitch_look_for_repo(text, integer) from public, anon;
grant execute on function public.pitch_look_for_repo(text, integer) to authenticated;
revoke execute on function public.pitch_settings_for_repo(text, integer) from public, anon;
grant execute on function public.pitch_settings_for_repo(text, integer) to authenticated;
revoke execute on function public.claim_answer(text, text, text, text, text, integer) from public, anon;
grant execute on function public.claim_answer(text, text, text, text, text, integer) to authenticated;
revoke execute on function public.business_for_token(text, text, integer) from public;
grant execute on function public.business_for_token(text, text, integer) to anon, authenticated;
