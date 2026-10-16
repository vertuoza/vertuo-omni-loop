-- A roadmap born on the server, in its product (PRD 2011 s1, docs:
-- .omni-loop/delivery/inbox/2011-product-records/spec.md, "1. A roadmap is a dossier"), and the rollout
-- ladder step of each product repository.
--
-- - dossiers.kind gains `roadmap`. A product roadmap is a dossier of that kind keyed by its product and a
--   number from the product's own counter, products.roadmap_seq: `mobile-R3` (roadmap_id_of()). A product
--   PRD and a product roadmap may share a number (mobile-3 and mobile-R3): dossiers_product_seq_key is
--   per product, kind and number. A roadmap dossier is born on the server, with no repository and no
--   issue.
-- - Its versions: `roadmap` (roadmap.md), `roadmap-prds` (its PRD rows), `roadmap-human-work` and
--   `roadmap-prerequisites`, each as the push sent it. A push adds a version only of what changed
--   (dossier_add_version()); the PRD rows and the human work are the JSON the push carried, which jsonb
--   writes the same way for the same content.
-- - roadmaps.dossier_id: the dossier of a roadmap born on the server; null for one born in git. A roadmap
--   is keyed by exactly one of its issue (repo and number, as before) and its dossier (roadmaps_key).
-- - roadmap_prds.prd_id: the row's PRD as text, `912` for a PRD of a repository or `mobile-12` for a
--   product PRD, back-filled from the integer `prd`, which a product PRD's row leaves null. The integer
--   stays and is kept in step (roadmap_prds_prd_id), so roadmap_push() of a git-born roadmap writes and
--   reads exactly as before. (The plan names the text column `roadmap_prds.prd`: the integer holds that
--   name, so the text one is `prd_id`.)
-- - roadmap_product_push(): the only writer of a product roadmap. With no number it creates the
--   product's next roadmap; with one it pushes to it. Any member of the product's workspace pushes, as
--   roadmap_push() lets any member (BR-PRODUCT-81); each push replaces the PRD rows and the
--   prerequisites, keeps the human work as roadmap_push() does, and adds the versions that changed.
--   A change of roadmap.md voids the approval in force, as a PRD's dossier_push() does.
-- - dossier_approve() approves a product roadmap, pinning its roadmap.md; approvals.files holds at least
--   one file (a PRD's approval still pins its three or four), and approval_voids.kind takes `roadmap`.
-- - product_repositories.ladder_step: the rollout ladder step the repository is at in this product, 1 to
--   5 (1 approval, 2 the gate, 3 the outbox, 4 phase 0 on the server, 5 roadmaps and bug records), 1 for
--   every link until an owner moves it with product_repository_set_step().
--
-- Every change adds or widens: no column, row or function is dropped, and the constraints replaced
-- accept every row they accepted before. A roadmap born in git stores, reads and grades as before.
--
-- Proven by supabase/checks/roadmaps.sql (the product roadmap, its counter under two creates at once,
-- its versions, its approval) and supabase/checks/product_repositories.sql (the ladder step);
-- supabase/checks/dossiers.sql, approvals.sql and product_prd_ids.sql still pass unchanged.
--
-- Rollback (the down script): a follow-up migration that first refuses while any dossier of kind
-- `roadmap` exists, then drops product_repository_set_step(), product_repositories.ladder_step,
-- roadmap_product_push(), roadmap_id_of(), the roadmap_prds_prd_id trigger and its function,
-- roadmap_prds.prd_id (setting prd not null again), roadmaps.dossier_id and roadmaps_key (setting repo
-- and number not null again) and products.roadmap_seq; restores dossier_approve() of
-- 20261203100000_product_prd_ids.sql, dossier_takes() of 20261119090000_concept_dossiers.sql and the
-- kind checks of dossiers, dossier_versions and approval_voids as they were, approvals.files at 3 or
-- more, and dossiers_product_prd and dossiers_product_seq_key as 20261203100000_product_prd_ids.sql made
-- them. After a product roadmap exists, keep it.

-- ── The roadmap dossier ──────────────────────────────────────────────────────────

alter table public.dossiers drop constraint dossiers_kind_check;
alter table public.dossiers add constraint dossiers_kind_check check (kind in ('prd', 'visual', 'bug', 'concept', 'roadmap'));

comment on column public.dossiers.kind is
  'prd, visual (a visual fix), bug (a bug fix), concept (PRD 1272) or roadmap (PRD 2011: a roadmap born on the server, keyed by its product and product_seq). For a fix or a concept, prd holds its issue''s number: it is never a draft.';

-- A product's PRDs and its roadmaps count apart: mobile-3 and mobile-R3 are two dossiers. A roadmap, like
-- a PRD and unlike a fix or a concept, has no issue number: its product's counter numbers it.
alter table public.dossiers
  drop constraint dossiers_product_prd,
  add constraint dossiers_product_prd check (product_seq is null or (kind in ('prd', 'roadmap') and prd is null)),
  drop constraint dossiers_product_seq_key,
  add constraint dossiers_product_seq_key unique (product_id, kind, product_seq),
  add constraint dossiers_roadmap_on_product check (kind <> 'roadmap' or product_seq is not null),
  drop constraint dossiers_fix_numbered,
  add constraint dossiers_fix_numbered check (kind in ('prd', 'roadmap') or prd is not null);

comment on column public.dossiers.product_seq is
  'PRD 1548: a product PRD''s number on its product (12 in mobile-12); PRD 2011: a product roadmap''s (3 in mobile-R3). Null for a dossier of a repository. Set at its birth, never changed.';

alter table public.dossier_versions drop constraint dossier_versions_kind_check;
alter table public.dossier_versions add constraint dossier_versions_kind_check
  check (kind in ('spec', 'plan', 'before-after', 'variations', 'bug-record', 'voice', 'concept-record', 'vision', 'board', 'debate',
                  'roadmap', 'roadmap-prds', 'roadmap-human-work', 'roadmap-prerequisites'));

-- As 20261119090000_concept_dossiers.sql, with the roadmap's four kinds.
create or replace function public.dossier_takes(p_dossier_kind text, p_version_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_dossier_kind
           when 'prd' then p_version_kind in ('spec', 'plan', 'before-after', 'voice')
           when 'visual' then p_version_kind in ('before-after', 'variations')
           when 'bug' then p_version_kind = 'bug-record'
           when 'concept' then p_version_kind in ('concept-record', 'vision', 'board', 'debate')
           when 'roadmap' then p_version_kind in ('roadmap', 'roadmap-prds', 'roadmap-human-work', 'roadmap-prerequisites')
           else false
         end
$$;

-- ── A product's roadmap counter ──────────────────────────────────────────────────

alter table public.products
  add column roadmap_seq integer not null default 0 constraint products_roadmap_seq_check check (roadmap_seq >= 0);

comment on column public.products.roadmap_seq is
  'PRD 2011: the product''s last roadmap number (0 before its first). roadmap_product_push() takes the next one under the row''s lock, so numbers have no gap.';

-- A product roadmap's id, `<key>-R<n>`; null for a product with no key.
create function public.roadmap_id_of(p_product uuid, p_seq integer) returns text
language sql stable
security definer
set search_path = ''
as $$
  select p.key || '-R' || p_seq from public.products p where p.id = p_product and p_seq is not null
$$;

-- ── A roadmap keyed by its issue or by its dossier ───────────────────────────────

alter table public.roadmaps
  add column dossier_id uuid constraint roadmaps_dossier_key unique references public.dossiers (id) on delete cascade,
  alter column repo drop not null,
  alter column number drop not null,
  add constraint roadmaps_key check (num_nonnulls(number, dossier_id) = 1 and (repo is null) = (number is null));

comment on column public.roadmaps.dossier_id is
  'PRD 2011: the dossier (kind roadmap) of a roadmap born on the server, whose versions keep every push; null for a roadmap born in git, keyed by repo and number.';
comment on column public.roadmaps.repo is 'owner/name, in lower case: the repository holding roadmap.md. Null for a roadmap born on the server.';
comment on column public.roadmaps.number is 'The roadmap issue''s number: its id in the repository. Null for a roadmap born on the server, whose dossier numbers it.';
comment on column public.roadmaps.document is 'The last pushed roadmap.md. A roadmap born on the server keeps every one as a version of its dossier.';

-- ── A roadmap row names a PRD of a repository or of a product ────────────────────

alter table public.roadmap_prds add column prd_id text;
update public.roadmap_prds set prd_id = prd::text;
alter table public.roadmap_prds
  alter column prd_id set not null,
  alter column prd drop not null,
  add constraint roadmap_prds_prd_id_shape check (
    char_length(prd_id) <= 52 and prd_id ~ '^([1-9][0-9]{0,8}|[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*-[1-9][0-9]{0,8})$'),
  add constraint roadmap_prds_prd_in_step check (
    case when prd is null then prd_id !~ '^[0-9]+$' else prd_id = prd::text end);

comment on column public.roadmap_prds.prd_id is
  'PRD 2011: the row''s PRD, 912 for a PRD of a repository or mobile-12 for a product PRD.';
comment on column public.roadmap_prds.prd is
  'The row''s PRD number when it is a PRD of a repository (prd_id 912); null for a product PRD. Kept in step with prd_id.';

-- The two columns say the same PRD: a write naming one fills the other, so a writer of either keeps working.
create function public.roadmap_prds_prd_id() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.prd is distinct from old.prd and new.prd_id is not distinct from old.prd_id then
    new.prd_id := null;
  elsif tg_op = 'UPDATE' and new.prd_id is distinct from old.prd_id and new.prd is not distinct from old.prd then
    new.prd := null;
  end if;
  new.prd_id := btrim(new.prd_id);
  if new.prd_id is null and new.prd is not null then
    new.prd_id := new.prd::text;
  elsif new.prd is null and new.prd_id ~ '^[1-9][0-9]{0,8}$' then
    new.prd := new.prd_id::integer;
  end if;
  return new;
end;
$$;

create trigger roadmap_prds_prd_id
  before insert or update of prd, prd_id on public.roadmap_prds
  for each row execute function public.roadmap_prds_prd_id();

-- ── The only writer of a product roadmap ─────────────────────────────────────────

-- One push of the kit's `omni roadmap push --product <key>`. p_key is the product's key; p_roadmap null
-- creates the product's next roadmap, a number pushes to `<key>-R<n>`; p_repo only says which workspace
-- when two of the caller's hold the key. `p_body`:
--   {title, milestone, target?, source?, questions, document,
--    prds: [{id, prd ('912' or 'mobile-12'), title, repos, blockers, wave, state, waitsOn?, waitsOnUrl?,
--            startedAt?, endedAt?}],
--    humanWork?: [{key, prd, repo, source, text, act, url, ruleKind}],
--    prerequisites?: [{id, category, need, check?, fix?, blocks: 'all' | [row id], who, repos?, card?}],
--    prerequisiteResult?: {machine, checkedAt, rows: [{id, state, detail?}]}}
-- Answers {roadmapId, dossierId, roadmap, created, product: {id, name}, added: [{kind, version}],
-- unchanged: [kind]}: `roadmap` the id `<key>-R<n>`. Refused: 42501 signed out; P0002 no product of that
-- key in the caller's workspaces, or no such roadmap on it; 22023 a malformed argument.
create function public.roadmap_product_push(p_key text, p_roadmap integer, p_body jsonb, p_repo text default null)
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

  -- The approval in force before this push: the latest, unless a void follows it.
  select a.* into in_force
    from public.approvals a
   where a.dossier_id = target.id
   order by a.approved_at desc, a.id desc
   limit 1;
  if found and exists (select 1 from public.approval_voids x where x.approval_id = in_force.id) then
    in_force := null;
  end if;

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

-- ── Approving a product roadmap ──────────────────────────────────────────────────

alter table public.approvals drop constraint approvals_files_check;
alter table public.approvals add constraint approvals_files_check check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) >= 1);

comment on column public.approvals.files is
  'The files the approval pinned: [{kind, path, sha256, version_id}]. A PRD''s spec, plan, before/after and voice; a product roadmap''s roadmap.md (PRD 2011).';

alter table public.approval_voids drop constraint approval_voids_kind_check;
alter table public.approval_voids add constraint approval_voids_kind_check check (kind in ('spec', 'plan', 'before-after', 'voice', 'roadmap'));

-- As 20261203100000_product_prd_ids.sql, and a product roadmap: approved on its page, pinning its
-- roadmap.md, its answer carrying its id `<key>-R<n>` as `roadmap`.
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

-- ── The rollout ladder ───────────────────────────────────────────────────────────

alter table public.product_repositories
  add column ladder_step integer not null default 1 constraint product_repositories_ladder_step_check check (ladder_step between 1 and 5);

comment on column public.product_repositories.ladder_step is
  'PRD 2011: the rollout ladder step the repository is at in this product: 1 approval, 2 the gate, 3 the outbox, 4 phase 0 born on the server, 5 roadmaps and bug records born on the server. Set by an owner with product_repository_set_step().';

-- Moves a linked repository to a step of the ladder, up or down. Answers the link. 42501 signed out or
-- not an owner, P0002 no such product or a repository it does not link, 22023 a step outside 1 to 5.
create function public.product_repository_set_step(p_product uuid, p_repository text, p_step integer)
returns public.product_repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
  repo  text := lower(btrim(coalesce(p_repository, '')));
  moved public.product_repositories;
begin
  owned := public.product_repository_owned(p_product);
  if p_step is null or p_step not between 1 and 5 then
    raise exception 'Step: the ladder has steps 1 to 5.' using errcode = '22023', hint = 'ladder_step';
  end if;
  update public.product_repositories l set ladder_step = p_step
   where l.product_id = owned.id and l.repository = repo
  returning * into moved;
  if not found then
    raise exception 'Repository: % is not in %.', p_repository, owned.name using errcode = 'P0002', hint = 'repository';
  end if;
  return moved;
end;
$$;

-- ── Who may call what ────────────────────────────────────────────────────────────

revoke execute on function public.roadmap_id_of(uuid, integer) from public, anon, authenticated;
revoke execute on function public.roadmap_prds_prd_id() from public, anon, authenticated;
revoke execute on function public.roadmap_product_push(text, integer, jsonb, text) from public, anon;
grant execute on function public.roadmap_product_push(text, integer, jsonb, text) to authenticated;
revoke execute on function public.product_repository_set_step(uuid, text, integer) from public, anon;
grant execute on function public.product_repository_set_step(uuid, text, integer) to authenticated;
