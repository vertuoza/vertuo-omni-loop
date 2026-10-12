-- A concept is a dossier kind (PRD 1272, docs: .omni-loop/delivery/inbox/1272-concepts-page/spec.md):
-- /omni:think-big's concept, recorded as a folder `<delivery>/inbox/concepts/<nnnn>-<slug>/`, gets a
-- dossier beside the PRDs' and the fixes', in the same tables, read under the same rules.
--
--   dossiers.kind                 takes `concept`, numbered by the concept's issue: a concept is never a
--                                 draft (dossiers_fix_numbered already asks a number of every kind but prd)
--   dossier_versions.kind         gains `concept-record` (concept.md), `vision` (vision.html), `board` (a
--                                 board-r<k>.html, one version per round) and `debate` (debate.md)
--   dossier_takes()               a `concept` dossier takes exactly those four; the other kinds as before
--   dossier_add_version()         as 20261011090000_fix_dossiers.sql, a `board` deduped as a round of
--                                 `variations` is: added unless one of the same content is there, so
--                                 pushing rounds 1..k again adds nothing, and round k+1 comes after round k
--   dossier_push()                as 20261024090000_customer_voice.sql, taking the kind `concept` and its
--                                 four version kinds, a board sent once per round
--
-- Existing rows, kinds and row-level security are unchanged: every check is widened, never narrowed.
-- Proven by supabase/checks/dossiers.sql.
--
-- Rollback: delete every `concept` dossier (its versions go with it), then a follow-up migration restores
-- both checks, dossier_takes() and dossier_push() of 20261024090000_customer_voice.sql and
-- dossier_add_version() of 20261011090000_fix_dossiers.sql.

-- ── The kind of a dossier ──────────────────────────────────────────────────────

alter table public.dossiers drop constraint dossiers_kind_check;
alter table public.dossiers add constraint dossiers_kind_check check (kind in ('prd', 'visual', 'bug', 'concept'));

comment on column public.dossiers.kind is
  'prd, visual (a visual fix), bug (a bug fix) or concept (PRD 1272). For a fix or a concept, prd holds its issue''s number: it is never a draft.';

-- ── The kinds of a version, and which dossier takes which ──────────────────────

alter table public.dossier_versions drop constraint dossier_versions_kind_check;
alter table public.dossier_versions add constraint dossier_versions_kind_check
  check (kind in ('spec', 'plan', 'before-after', 'variations', 'bug-record', 'voice', 'concept-record', 'vision', 'board', 'debate'));

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
           else false
         end
$$;

-- ── The version rule: a board is a round ────────────────────────────────────────

-- As 20261011090000_fix_dossiers.sql, a `board` deduped per round as a round of `variations` is.
create or replace function public.dossier_add_version(
  p_dossier     uuid,
  p_kind        text,
  p_content     text,
  p_source      text,
  p_uploaded_by uuid default null,
  p_commit_sha  text default null,
  p_git_blob    text default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  body   bytea := convert_to(p_content, 'UTF8');
  hash   text := encode(sha256(convert_to(p_content, 'UTF8')), 'hex');
  latest text;
begin
  if p_content is null then
    raise exception 'A version needs its content.' using errcode = '22023';
  end if;
  if octet_length(body) > 524288 then
    raise exception 'An artifact holds 512 KiB at most: this % is % bytes.', p_kind, octet_length(body) using errcode = '54000';
  end if;
  perform 1 from public.dossiers d where d.id = p_dossier for update;
  if not found then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  if p_kind in ('variations', 'board') then
    if exists (select 1 from public.dossier_versions v where v.dossier_id = p_dossier and v.kind = p_kind and v.sha256 = hash) then
      return null;
    end if;
  else
    select v.sha256 into latest
      from public.dossier_versions v
     where v.dossier_id = p_dossier and v.kind = p_kind
     order by v.created_at desc, v.id desc
     limit 1;
    if latest is not distinct from hash then
      return null;
    end if;
  end if;
  insert into public.dossier_versions (dossier_id, kind, content, sha256, bytes, source, uploaded_by, commit_sha, git_blob, created_at)
  values (p_dossier, p_kind, p_content, hash, octet_length(body), p_source, p_uploaded_by, p_commit_sha, p_git_blob, clock_timestamp());
  return (select count(*)::integer from public.dossier_versions v where v.dossier_id = p_dossier and v.kind = p_kind);
end;
$$;

-- ── The kit's push, with the concept ────────────────────────────────────────────

-- As 20261024090000_customer_voice.sql, with the kind `concept`, its four version kinds, and a board
-- sent once per round, as a round of variations is.
create or replace function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb, p_kind text default 'prd')
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
  pick      record;
  draft     public.dossiers%rowtype;
  target    public.dossiers%rowtype;
  item      jsonb;
  kinds     text[] := '{}';
  v_version integer;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
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

  for item in select value from jsonb_array_elements(p_artifacts) loop
    v_version := public.dossier_add_version(target.id, item ->> 'kind', item ->> 'content', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item ->> 'kind');
    else
      added := added || jsonb_build_object('kind', item ->> 'kind', 'version', v_version);
    end if;
  end loop;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged);
end;
$$;
