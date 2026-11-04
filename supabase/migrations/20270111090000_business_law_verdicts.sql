-- The business laws' verdicts on a PRD's spec (PRD 2632 s4, docs: .omni-loop/delivery/inbox/2632-business-laws/spec.md,
-- "The judge" and "On a PRD approved on its page").
--
-- A ◆ PRD's spec is judged against the business laws of its product's law home (product_law_home(),
-- 20270110090000_business_law_home.sql), read from the newest knowledge pack of that repository: merged laws
-- only, so a pull request's unmerged change to a law changes no verdict. Galaxy's judge does the judging; the
-- database keeps what it said and holds Approve on a red.
--
-- - business_law_verdicts: one verdict per spec version and pack commit (`unique (dossier_version_id,
--   pack_sha)`): green, red or neutral, why, the laws judged, the domains taken with their reasons, and each
--   finding with the law's statement and Why as they were, so an old red still reads true once the law is
--   amended. A red has at least one finding, a green and a neutral none. Never changed or deleted; only the
--   deletion of its dossier (or workspace) takes it away.
-- - business_law_verdict_put(): the only writer, the service role's alone (galaxy's judge). The same spec
--   version and pack again keeps the first verdict and answers it: a verdict is never rewritten.
-- - business_law_judge_input(): what the judge reads for a dossier, the service role's alone: its latest
--   spec, its law home, that home's newest pack in the dossier's workspace (its business-laws.md files and
--   its config only), the product's glossary, and the verdict already kept, if any.
-- - business_law_verdict_of(): what a member reads on the PRD's page and the approval route reads before
--   it approves: the latest spec version, the law home, its newest pack, and the verdict kept at those two;
--   or, given a spec version (the approved one), that version's latest verdict. Null for anyone else.
-- - dossier_approve(): as 20261210100000_product_roadmaps.sql, and it refuses a PRD whose latest spec
--   version has a red verdict at its law home's newest pack, whoever calls. A red at an older pack, a green,
--   a neutral and no verdict at all approve as before.
-- - Who reads: a member of the verdict's workspace, through row-level security. Nobody signed in writes.
--
-- Proven by supabase/checks/business_law_verdicts.sql.
--
-- Rollback: a follow-up migration restores dossier_approve() from 20261210100000_product_roadmaps.sql, then
-- drops business_law_verdict_of(), business_law_judge_input(), business_law_verdict_put() and the
-- business_law_verdicts table (its trigger and function with it). Nothing else reads them.

-- ── The verdicts ─────────────────────────────────────────────────────────────────

create table public.business_law_verdicts (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces on delete cascade,
  dossier_id         uuid not null references public.dossiers on delete cascade,
  dossier_version_id uuid not null references public.dossier_versions on delete cascade,
  law_home           text not null constraint business_law_verdicts_law_home_check check (law_home ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  pack_sha           text not null constraint business_law_verdicts_pack_sha_check check (pack_sha ~ '^[0-9a-f]{40}$'),
  state              text not null constraint business_law_verdicts_state_check check (state in ('green', 'red', 'neutral')),
  reason             text not null constraint business_law_verdicts_reason_check check (char_length(reason) between 1 and 500),
  laws               jsonb not null constraint business_law_verdicts_laws_check check (jsonb_typeof(laws) = 'array'),
  domains            jsonb not null constraint business_law_verdicts_domains_check check (jsonb_typeof(domains) = 'array'),
  findings           jsonb not null constraint business_law_verdicts_findings_check check (jsonb_typeof(findings) = 'array'),
  judged_at          timestamptz not null default clock_timestamp(),
  constraint business_law_verdicts_once unique (dossier_version_id, pack_sha),
  constraint business_law_verdicts_red_has_findings check ((state = 'red') = (jsonb_array_length(findings) > 0))
);

create index business_law_verdicts_dossier_idx on public.business_law_verdicts (dossier_id, judged_at desc);

comment on table public.business_law_verdicts is
  'PRD 2632: a ◆ PRD spec version judged against its law home''s business laws at one pack commit. Written only by business_law_verdict_put() (the service role); read by the workspace''s members; never changed or deleted.';
comment on column public.business_law_verdicts.dossier_version_id is 'The spec version judged.';
comment on column public.business_law_verdicts.law_home is 'owner/name in lower case: the repository the laws were read from.';
comment on column public.business_law_verdicts.pack_sha is 'The commit of the law home''s knowledge pack the laws were read at: merged laws only.';
comment on column public.business_law_verdicts.state is 'red: the spec breaks at least one law; green: it breaks none; neutral: it could not be judged (why in reason).';
comment on column public.business_law_verdicts.laws is 'The ids of the laws judged, in the order judged.';
comment on column public.business_law_verdicts.domains is 'The domains taken, each {key, reasons}: `areas`, or the spec''s words that pointed to it.';
comment on column public.business_law_verdicts.findings is
  'Each break: {law, statement, why, quote, domain, file, owners}, the law''s words as they were when judged.';

-- Nobody updates a verdict, and nobody deletes one: only its dossier's or workspace's deletion cascades to it
-- (a referential action runs inside a trigger, a direct delete does not).
create function public.business_law_verdicts_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'A business law verdict is never changed or deleted: push the spec again to have it judged anew.' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger business_law_verdicts_append_only
  before update or delete on public.business_law_verdicts
  for each row execute function public.business_law_verdicts_append_only();

alter table public.business_law_verdicts enable row level security;

create policy "a member reads their workspace's business law verdicts" on public.business_law_verdicts
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- ── A verdict as it is answered ──────────────────────────────────────────────────

create function public.business_law_verdict_json(v public.business_law_verdicts) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'specVersion', v.dossier_version_id, 'lawHome', v.law_home, 'packSha', v.pack_sha, 'state', v.state,
    'reason', v.reason, 'laws', v.laws, 'domains', v.domains, 'findings', v.findings, 'judgedAt', v.judged_at)
$$;

-- ── The writer: galaxy's judge ───────────────────────────────────────────────────

-- Keeps the verdict on spec version p_version at the law home's pack of commit p_pack_sha, unless one is
-- kept already: either way, answers the verdict kept. 22023 a malformed value, its field first in the
-- message and in `hint`; P0002 a version that is no PRD's spec, or a pack its workspace does not hold.
create function public.business_law_verdict_put(
  p_version  uuid,
  p_pack_sha text,
  p_state    text,
  p_reason   text,
  p_laws     jsonb,
  p_domains  jsonb,
  p_findings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sha   text := lower(btrim(coalesce(p_pack_sha, '')));
  target  public.dossiers%rowtype;
  home    text;
  f       jsonb;
  kept    public.business_law_verdicts;
begin
  select d.* into target
    from public.dossier_versions v join public.dossiers d on d.id = v.dossier_id
   where v.id = p_version and v.kind = 'spec' and d.kind = 'prd';
  if not found then
    raise exception 'Version: % is no PRD''s spec.', p_version using errcode = 'P0002', hint = 'version';
  end if;
  home := public.product_law_home(target.product_id);
  if home is null then
    raise exception 'Law home: the PRD''s product has none, so nothing is judged.' using errcode = '22023', hint = 'law_home';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Pack sha: the full 40-character commit.' using errcode = '22023', hint = 'pack_sha';
  end if;
  if not exists (select 1 from public.knowledge_packs p
                  where p.workspace_id = target.workspace_id and p.repository = home and p.sha = v_sha) then
    raise exception 'Pack sha: % is no pack of % in this workspace.', v_sha, home using errcode = 'P0002', hint = 'pack_sha';
  end if;
  if p_state is null or p_state not in ('green', 'red', 'neutral') then
    raise exception 'State: green, red or neutral.' using errcode = '22023', hint = 'state';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Reason: 1 to 500 characters.' using errcode = '22023', hint = 'reason';
  end if;
  if p_laws is null or jsonb_typeof(p_laws) <> 'array' or jsonb_array_length(p_laws) > 5000
     or exists (select 1 from jsonb_array_elements(p_laws) e
                 where jsonb_typeof(e.value) <> 'string' or e.value #>> '{}' !~ '^BL-[A-Z0-9]+-[1-9][0-9]*$') then
    raise exception 'Laws: a list of business law ids, BL-<CODE>-<n>.' using errcode = '22023', hint = 'laws';
  end if;
  if p_domains is null or jsonb_typeof(p_domains) <> 'array' or jsonb_array_length(p_domains) > 500
     or exists (select 1 from jsonb_array_elements(p_domains) e
                 where jsonb_typeof(e.value) <> 'object' or jsonb_typeof(e.value -> 'key') <> 'string'
                    or jsonb_typeof(e.value -> 'reasons') <> 'array') then
    raise exception 'Domains: a list of {key, reasons}.' using errcode = '22023', hint = 'domains';
  end if;
  if p_findings is null or jsonb_typeof(p_findings) <> 'array' or jsonb_array_length(p_findings) > 500 then
    raise exception 'Findings: a list of at most 500 breaks.' using errcode = '22023', hint = 'findings';
  end if;
  for f in select e.value from jsonb_array_elements(p_findings) e loop
    if jsonb_typeof(f) <> 'object'
       or jsonb_typeof(f -> 'law') is distinct from 'string' or not (p_laws ? (f ->> 'law'))
       or jsonb_typeof(f -> 'statement') is distinct from 'string'
       or jsonb_typeof(f -> 'why') is distinct from 'string'
       or jsonb_typeof(f -> 'quote') is distinct from 'string' or char_length(btrim(f ->> 'quote')) not between 1 and 300 then
      raise exception 'Findings: each names a law judged, its statement and Why, and the spec''s words (1 to 300 characters).'
        using errcode = '22023', hint = 'findings';
    end if;
  end loop;
  if (p_state = 'red') <> (jsonb_array_length(p_findings) > 0) then
    raise exception 'State: red exactly when there is a finding.' using errcode = '22023', hint = 'state';
  end if;

  insert into public.business_law_verdicts
    (workspace_id, dossier_id, dossier_version_id, law_home, pack_sha, state, reason, laws, domains, findings)
  values (target.workspace_id, target.id, p_version, home, v_sha, p_state, btrim(p_reason), p_laws, p_domains, p_findings)
  on conflict (dossier_version_id, pack_sha) do nothing;

  select * into kept from public.business_law_verdicts b where b.dossier_version_id = p_version and b.pack_sha = v_sha;
  return public.business_law_verdict_json(kept);
end;
$$;

-- ── What the judge reads ─────────────────────────────────────────────────────────

-- The dossier's latest spec and what it is judged against: {dossier, server, specVersion, spec, lawHome,
-- pack: {sha, files: [{path, content}]}, glossary, domains, verdict}. `server` is whether it is a numbered
-- ◆ PRD, the only kind judged here; `pack` is the law home's newest in the dossier's workspace, holding its
-- business-laws.md files and its config only, or null; `glossary` the product's terms with their domains,
-- `domains` its domains with their names; `verdict` the one kept at that spec and pack, or null. Null when
-- there is no such dossier.
create function public.business_law_judge_input(p_dossier uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.dossiers%rowtype;
  spec   public.dossier_versions%rowtype;
  home   text;
  pack   public.knowledge_packs%rowtype;
  kept   public.business_law_verdicts%rowtype;
begin
  select d.* into target from public.dossiers d where d.id = p_dossier;
  if not found then
    return null;
  end if;
  select v.* into spec from public.dossier_versions v
   where v.dossier_id = target.id and v.kind = 'spec' order by v.created_at desc, v.id desc limit 1;
  home := public.product_law_home(target.product_id);
  if home is not null then
    select p.* into pack from public.knowledge_packs p
     where p.workspace_id = target.workspace_id and p.repository = home and p.newest;
  end if;
  if spec.id is not null and pack.id is not null then
    select b.* into kept from public.business_law_verdicts b where b.dossier_version_id = spec.id and b.pack_sha = pack.sha;
  end if;
  return jsonb_build_object(
    'dossier', target.id,
    'server', target.kind = 'prd' and target.birthplace = 'server' and (target.prd is not null or target.product_seq is not null),
    'specVersion', spec.id,
    'spec', spec.content,
    'lawHome', home,
    'pack', case when pack.id is null then null else jsonb_build_object(
      'sha', pack.sha,
      'files', coalesce((select jsonb_agg(jsonb_build_object('path', f.path, 'content', f.content) order by f.path collate "C")
                           from public.knowledge_pack_files f
                          where f.pack_id = pack.id and f.workspace_id = pack.workspace_id
                            and (f.path ~ '(^|/)business-laws\.md$' or f.path = '.omni-loop/config.yml')), '[]'::jsonb)) end,
    'glossary', case when target.product_id is null then '[]'::jsonb
                     else coalesce(public.product_knowledge_for_agents(target.product_id) -> 'glossary', '[]'::jsonb) end,
    'domains', case when target.product_id is null then '[]'::jsonb
                    else coalesce(public.product_knowledge_for_agents(target.product_id) -> 'domains', '[]'::jsonb) end,
    'verdict', case when kept.id is null then null else public.business_law_verdict_json(kept) end);
end;
$$;

-- ── What a member reads ──────────────────────────────────────────────────────────

-- For a member of the dossier's workspace: {dossier, specVersion, lawHome, packSha, verdict}. Without
-- p_version, the latest spec version and the law home's newest pack, with the verdict kept at those two
-- (null: not judged there yet). With p_version, a spec version of the dossier (the one an approval pinned),
-- its latest verdict whatever the pack. Null for anyone else, and for no such dossier or version.
create function public.business_law_verdict_of(p_dossier uuid, p_version uuid default null) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target  public.dossiers%rowtype;
  version uuid;
  home    text;
  sha     text;
  kept    public.business_law_verdicts%rowtype;
begin
  select d.* into target from public.dossiers d where d.id = p_dossier;
  if not found or (select auth.uid()) is null or not public.is_member(target.workspace_id) then
    return null;
  end if;
  home := public.product_law_home(target.product_id);
  if p_version is not null then
    select v.id into version from public.dossier_versions v where v.id = p_version and v.dossier_id = target.id and v.kind = 'spec';
    if version is null then
      return null;
    end if;
    select b.* into kept from public.business_law_verdicts b
     where b.dossier_version_id = version order by b.judged_at desc, b.id desc limit 1;
    sha := kept.pack_sha;
  else
    select v.id into version from public.dossier_versions v
     where v.dossier_id = target.id and v.kind = 'spec' order by v.created_at desc, v.id desc limit 1;
    if home is not null then
      select p.sha into sha from public.knowledge_packs p
       where p.workspace_id = target.workspace_id and p.repository = home and p.newest;
    end if;
    if version is not null and sha is not null then
      select b.* into kept from public.business_law_verdicts b where b.dossier_version_id = version and b.pack_sha = sha;
    end if;
  end if;
  return jsonb_build_object(
    'dossier', target.id, 'specVersion', version, 'lawHome', home, 'packSha', sha,
    'verdict', case when kept.id is null then null else public.business_law_verdict_json(kept) end);
end;
$$;

-- ── Approving: a red holds it ────────────────────────────────────────────────────

-- As 20261210100000_product_roadmaps.sql, and a PRD whose latest spec version has a red verdict at its law
-- home's newest pack is refused, its laws named (22023, hint `business_laws`). A red at an older pack, a
-- green, a neutral and no verdict approve as before: the page and the approval route judge before Approve.
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
  home    text;
  broken  text;
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

    -- PRD 2632: the latest spec's verdict at the law home's newest pack, when it is red, holds the approval.
    home := public.product_law_home(target.product_id);
    if home is not null then
      select string_agg(distinct e.value ->> 'law', ', ' order by e.value ->> 'law') into broken
        from public.business_law_verdicts b
        cross join lateral jsonb_array_elements(b.findings) e
       where b.state = 'red'
         and b.pack_sha = (select p.sha from public.knowledge_packs p
                            where p.workspace_id = target.workspace_id and p.repository = home and p.newest)
         and b.dossier_version_id = (select v.id from public.dossier_versions v
                                      where v.dossier_id = target.id and v.kind = 'spec'
                                      order by v.created_at desc, v.id desc limit 1);
      if broken is not null then
        raise exception 'Business laws: PRD %''s spec breaks %. Change the spec, or ask the law''s owner to amend it.', label, broken
          using errcode = '22023', hint = 'business_laws';
      end if;
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

  insert into public.approvals (dossier_id, approved_by, approver_login, files)
  values (target.id, caller, left(login, 200), pinned)
  returning id into made;

  return jsonb_build_object('id', made, 'repo', target.home_repo, 'prd', target.prd)
    || case when target.kind = 'roadmap' then jsonb_build_object('roadmap', label)
            when target.product_seq is not null then jsonb_build_object('prdId', public.prd_id_of(target.product_id, target.product_seq))
            else '{}'::jsonb end;
end;
$$;

-- ── Who may call what ────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): read, and write only
-- through the writer.
revoke all on public.business_law_verdicts from public, anon, authenticated, service_role;
grant select on public.business_law_verdicts to authenticated, service_role;

revoke execute on function public.business_law_verdicts_append_only() from public, anon, authenticated, service_role;
revoke execute on function public.business_law_verdict_json(public.business_law_verdicts) from public, anon, authenticated, service_role;
revoke execute on function public.business_law_verdict_put(uuid, text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.business_law_verdict_put(uuid, text, text, text, jsonb, jsonb, jsonb) to service_role;
revoke execute on function public.business_law_judge_input(uuid) from public, anon, authenticated;
grant execute on function public.business_law_judge_input(uuid) to service_role;
revoke execute on function public.business_law_verdict_of(uuid, uuid) from public, anon;
grant execute on function public.business_law_verdict_of(uuid, uuid) to authenticated;
