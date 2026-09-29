-- A fix is a dossier with a kind (PRD 627, docs: .omni-loop/delivery/inbox/0627-fixes-under-work/spec.md):
-- a visual fix (/omni:visual-fix, PRD 541) and a bug fix (/omni:bug-fix, PRD 556) each get a dossier,
-- beside the PRDs', in the same tables, read under the same rules.
--
-- - dossiers.kind: `prd` (every existing row, and the default), `visual` or `bug`. For a fix, `prd` holds
--   its issue's number: a fix is never a draft. The key becomes (workspace, repository, kind, number), so
--   a visual fix and a PRD may share a number in one repository. The new key is added and the old one
--   dropped in one statement, so no moment exists without a key.
-- - dossier_versions.kind gains `variations` (one version per round the person picked from) and
--   `bug-record` (the fix's bug.md). A `prd` dossier takes spec, plan and before-after; a `visual` one
--   before-after and variations; a `bug` one bug-record. A trigger refuses any other pairing, whoever
--   writes: the kit's push and the fallback alike.
-- - The version rule, for `variations` only: a round is added unless one of the same content is already
--   there, so pushing rounds 1..k again adds nothing, and round k+1 comes after round k.
-- - dossier_push() takes the kind (a missing one is `prd`, so older kits push as before) and finds or
--   creates the dossier by the new key. A push naming a draft is a PRD's: a fix never has one.
-- - dossier_list() also returns the kind, so /prd lists only `prd` dossiers and /visual and /bugs theirs.
--
-- Rollback: a follow-up migration deletes the `visual` and `bug` dossiers, drops the trigger, restores
-- the old key, the old version check, dossier_push() of 20261004090000_workspace_gate.sql and
-- dossier_list() of 20260928110000_dossier_list.sql, then drops the column. PRD dossiers are untouched.

-- ── The kind of a dossier ──────────────────────────────────────────────────────

alter table public.dossiers
  add column kind text not null default 'prd' constraint dossiers_kind_check check (kind in ('prd', 'visual', 'bug'));

comment on column public.dossiers.kind is
  'prd, visual (a visual fix) or bug (a bug fix). For a fix, prd holds its issue''s number: a fix is never a draft.';

alter table public.dossiers
  add constraint dossiers_workspace_id_home_repo_kind_prd_key unique (workspace_id, home_repo, kind, prd),
  drop constraint dossiers_workspace_id_home_repo_prd_key;

alter table public.dossiers
  add constraint dossiers_fix_numbered check (kind = 'prd' or prd is not null);

-- ── The kinds of a version, and which dossier takes which ──────────────────────

alter table public.dossier_versions drop constraint dossier_versions_kind_check;
alter table public.dossier_versions add constraint dossier_versions_kind_check
  check (kind in ('spec', 'plan', 'before-after', 'variations', 'bug-record'));

-- Whether a dossier of `p_dossier_kind` takes a version of `p_version_kind`.
create function public.dossier_takes(p_dossier_kind text, p_version_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_dossier_kind
           when 'prd' then p_version_kind in ('spec', 'plan', 'before-after')
           when 'visual' then p_version_kind in ('before-after', 'variations')
           when 'bug' then p_version_kind = 'bug-record'
           else false
         end
$$;

create function public.dossier_versions_pairing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select d.kind into v_kind from public.dossiers d where d.id = new.dossier_id;
  if not public.dossier_takes(v_kind, new.kind) then
    raise exception 'A % dossier takes no % version.', v_kind, new.kind using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.dossier_versions_pairing() from public, anon, authenticated;

create trigger dossier_versions_pairing
  before insert or update of dossier_id, kind on public.dossier_versions
  for each row execute function public.dossier_versions_pairing();

-- ── The version rule ────────────────────────────────────────────────────────────

-- As 20260928090000_dossiers.sql, but a `variations` version (a round) is added unless one of the same
-- content is already there, not only the latest: the rounds are pushed together, oldest first.
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
  if p_kind = 'variations' then
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

-- ── The kit's push, by kind ─────────────────────────────────────────────────────

drop function public.dossier_push(text, integer, text, uuid, jsonb);

-- As 20261004090000_workspace_gate.sql, with the kind: `p_kind` (null or missing: prd) keys the
-- dossier with the repository and the number. Each artifact is one of spec, plan, before-after,
-- variations, bug-record, each sent once but variations (a round each, oldest first); the dossier's
-- kind must take it (the pairing trigger). A draft is a PRD's: a push naming one with another kind is
-- refused. Refused as before, and 22023 for an unknown kind or a pairing the kind does not take.
create function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb, p_kind text default 'prd')
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
  if v_kind not in ('prd', 'visual', 'bug') then
    raise exception 'A dossier''s kind is prd, visual or bug.' using errcode = '22023';
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
       or coalesce(item ->> 'kind', '') not in ('spec', 'plan', 'before-after', 'variations', 'bug-record')
       or jsonb_typeof(item -> 'content') is distinct from 'string' then
      raise exception 'Each artifact is {kind, content}, its kind one of spec, plan, before-after, variations, bug-record.' using errcode = '22023';
    end if;
    if (item ->> 'kind') <> 'variations' and (item ->> 'kind') = any (kinds) then
      raise exception 'Each kind is sent once: % came twice.', item ->> 'kind' using errcode = '22023';
    end if;
    if not public.dossier_takes(v_kind, item ->> 'kind') then
      raise exception 'A % dossier takes no % version.', v_kind, item ->> 'kind' using errcode = '22023';
    end if;
    kinds := kinds || (item ->> 'kind');
  end loop;

  if p_draft is not null then
    if v_kind <> 'prd' then
      raise exception 'A fix has no draft: push it by its number alone.' using errcode = '22023';
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

revoke execute on function public.dossier_push(text, integer, text, uuid, jsonb, text) from public, anon;
grant execute on function public.dossier_push(text, integer, text, uuid, jsonb, text) to authenticated;

-- ── The history, with the kind ──────────────────────────────────────────────────

drop function public.dossier_list(uuid);

-- As 20260928110000_dossier_list.sql, with each dossier's kind after its number.
create function public.dossier_list(p_dossier uuid default null)
returns table (
  id            uuid,
  workspace_id  uuid,
  home_repo     text,
  prd           integer,
  kind          text,
  title         text,
  opened_by     uuid,
  created_at    timestamptz,
  numbered_at   timestamptz,
  repos         text[],
  latest        jsonb,
  asked         integer,
  answered      integer,
  last_activity timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id as id, d.workspace_id as workspace_id, d.home_repo as home_repo, d.prd as prd, d.kind as kind, d.title as title,
         d.opened_by as opened_by, d.created_at as created_at, d.numbered_at as numbered_at,
         array[d.home_repo] || array(
           select distinct x.repo
             from unnest(q.repos || p.repos) as x (repo)
            where x.repo <> d.home_repo
            order by x.repo
         ) as repos,
         coalesce(v.latest, '{}'::jsonb) as latest,
         q.asked as asked,
         q.answered as answered,
         greatest(d.created_at, d.numbered_at, v.at, q.asked_at, q.answered_at) as last_activity
    from public.dossiers d
    -- Its rounds, by the two rules: how many, how many answered, when, and the repositories they were asked in.
    cross join lateral (
      select count(*)::integer as asked,
             (count(*) filter (where r.status = 'answered'))::integer as answered,
             max(r.created_at) as asked_at,
             max(r.answered_at) as answered_at,
             coalesce(array_agg(lower(r.repo)) filter (where r.repo is not null), '{}'::text[]) as repos
        from public.dossier_rounds(d.id) r
    ) q
    -- Its latest version of each kind, numbered by its place among its kind's.
    cross join lateral (
      select jsonb_object_agg(k.kind, jsonb_build_object('id', k.id, 'version', k.version, 'source', k.source, 'created_at', k.created_at)) as latest,
             max(k.created_at) as at
        from (
          select distinct on (dv.kind) dv.kind, dv.id, dv.source, dv.created_at, count(*) over (partition by dv.kind) as version
            from public.dossier_versions dv
           where dv.dossier_id = d.id
           order by dv.kind, dv.created_at desc, dv.id desc
        ) k
    ) v
    -- A PRD of its workspace's plan repository: its planet's regions, each a repository of the workspace's organisation.
    cross join lateral (
      select coalesce(array_agg(lower(w.github_org || '/' || e.region)), '{}'::text[]) as repos
        from public.workspaces w
        join public.ledger_events e
          on e.workspace_id = w.id and e.planet = d.prd and e.type = 'REGION_SURVEYED' and e.region is not null
       where w.id = d.workspace_id
         and d.kind = 'prd'
         and w.github_org is not null
         and w.plan_repo is not null
         and d.home_repo = lower(w.github_org || '/' || w.plan_repo)
    ) p
   where p_dossier is null or d.id = p_dossier
   order by last_activity desc, d.id
$$;

comment on function public.dossier_list(uuid) is
  'Each dossier of the caller''s workspaces (or only p_dossier), newest activity first: its kind, its repositories (home, its questions'', its planet''s regions), its latest version of each kind, its question counts and its last activity. Security invoker: the caller''s row-level security decides.';

revoke execute on function public.dossier_list(uuid) from public, anon;
grant execute on function public.dossier_list(uuid) to authenticated;

-- ── Who may read and write the kind ─────────────────────────────────────────────

grant select (kind) on public.dossiers to authenticated;
-- The fallback opens a fix's dossier by its key, kind included.
grant insert (kind) on public.dossiers to service_role;
