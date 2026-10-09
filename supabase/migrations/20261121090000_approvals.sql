-- A PRD born on the server is approved on its PRD page (PRD 1299 s2, docs:
-- .omni-loop/delivery/inbox/1299-server-approval/spec.md §2 and §3).
--
-- - dossiers.birthplace: `server` (◆, the brainstorm ran with the repository's phase 0 on `server`) or
--   `repo` (◇, a phase-0 pull request approves it). Set once, by the first spec version a PRD's dossier
--   takes: `server` when that spec's front matter says `phase0: server`, `repo` otherwise. Null until then
--   (a draft before its first push, a fix, a concept). Never changed once set.
-- - approvals: append-only, one row per approval: the dossier, the approver (and their GitHub login as it
--   was when they approved), the time, and `files`, one entry per approved file: its kind, its file name,
--   its sha256 and its version's id. The latest row is the approval in force. Nobody updates a row;
--   nobody deletes one but the cascade of its workspace's deletion.
-- - dossier_approve(dossier): a member of the dossier's workspace approves a numbered ◆ PRD that holds a
--   spec, a plan and a before/after, pinning the latest version of each of its kinds (voice included).
-- - dossier_approval(repo, prd): the approval in force of the PRD's dossier the caller may read, for the
--   kit (`GET /api/dossiers/approval`): the approver's login, whether they are a member today, the time
--   and each pinned file with its approved text; null when the caller reads no such dossier.
--
-- Proven by supabase/checks/approvals.sql.
--
-- Rollback: a follow-up migration drops dossier_approval(), dossier_approve(), the approvals table, the
-- two birthplace triggers and dossiers.birthplace. Nothing else reads them; every repository's phase 0
-- is `pr` until an owner switches one, so no ◆ dossier exists before that.

-- ── The birthplace ───────────────────────────────────────────────────────────────

alter table public.dossiers
  add column birthplace text check (birthplace in ('server', 'repo'));

comment on column public.dossiers.birthplace is
  'Where a PRD''s phase 0 is approved (PRD 1299): server, on its PRD page; repo, by its phase-0 pull request. Set once by its first spec version (phase0: server in its front matter), never changed; null before.';

-- Every PRD dossier that already holds a spec was born in the repository.
update public.dossiers d
   set birthplace = 'repo'
 where d.kind = 'prd'
   and exists (select 1 from public.dossier_versions v where v.dossier_id = d.id and v.kind = 'spec');

-- Whether a spec's front matter says `phase0: server`.
create function public.spec_says_server(p_content text) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    substring(p_content from '^---\r?\n(.*?)\r?\n---') ~ '(?n)^phase0:[ \t]*["'']?server["'']?[ \t]*\r?$',
    false)
$$;

-- The first spec version of a PRD's dossier sets its birthplace, once.
create function public.dossier_birthplace_from_spec() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'spec' then
    update public.dossiers d
       set birthplace = case when public.spec_says_server(new.content) then 'server' else 'repo' end
     where d.id = new.dossier_id and d.kind = 'prd' and d.birthplace is null;
  end if;
  return new;
end;
$$;

create trigger dossier_versions_birthplace
  after insert on public.dossier_versions
  for each row execute function public.dossier_birthplace_from_spec();

-- A birthplace, once set, never changes.
create function public.dossier_birthplace_once() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.birthplace is not null and new.birthplace is distinct from old.birthplace then
    raise exception 'A dossier''s birthplace is set once: this one was born %.', case old.birthplace when 'server' then 'on the server' else 'in the repository' end
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger dossiers_birthplace_once
  before update of birthplace on public.dossiers
  for each row execute function public.dossier_birthplace_once();

grant select (birthplace) on public.dossiers to authenticated;

-- ── The approvals ────────────────────────────────────────────────────────────────

create table public.approvals (
  id             uuid primary key default gen_random_uuid(),
  dossier_id     uuid not null references public.dossiers on delete cascade,
  approved_by    uuid not null,
  approver_login text not null check (char_length(approver_login) between 1 and 200),
  approved_at    timestamptz not null default clock_timestamp(),
  files          jsonb not null check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) >= 3)
);

comment on table public.approvals is
  'PRD 1299: one row per approval of a ◆ PRD, append-only. The latest row of a dossier is its approval in force. Written only by dossier_approve(); never updated; deleted only with its workspace.';
comment on column public.approvals.approved_by is
  'Who approved: their account. Not a foreign key, so an approval outlives its approver''s account.';
comment on column public.approvals.approver_login is 'The approver''s GitHub login when they approved, in lower case.';
comment on column public.approvals.files is
  'One entry per approved file: {kind, path, sha256, version_id}, the latest version of each kind at approval.';

create index approvals_in_force_idx on public.approvals (dossier_id, approved_at desc, id desc);

-- Nobody updates an approval, and nobody deletes one: only its workspace's deletion cascades to it
-- (a referential action runs inside a trigger, a direct delete does not).
create function public.approvals_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'An approval is never changed or deleted: approve again instead.' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger approvals_append_only
  before update or delete on public.approvals
  for each row execute function public.approvals_append_only();

alter table public.approvals enable row level security;

create policy "a member reads the approvals of their workspace's dossiers" on public.approvals
  for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id)));

revoke all on public.approvals from anon, authenticated, service_role;
grant select on public.approvals to authenticated, service_role;

-- ── Approving ────────────────────────────────────────────────────────────────────

-- The caller approves the dossier: a member of its workspace, a numbered PRD born on the server, holding
-- a spec, a plan and a before/after. Pins the latest version of each of its kinds and returns
-- {id, repo, prd}. 42501 signed out or not a member, P0002 no such dossier, 22023 any other refusal.
create function public.dossier_approve(p_dossier uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  target  public.dossiers%rowtype;
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

-- ── What the kit reads ───────────────────────────────────────────────────────────

-- The approval in force of PRD `p_prd` of `p_repo`, as the caller may read it: {dossier, approval}, the
-- approval null when there is none yet; null when the caller reads no such dossier (the most recently
-- numbered when two of their workspaces hold one). The approver's `member` is whether they belong to the
-- dossier's workspace today; each file carries its approved text.
create function public.dossier_approval(p_repo text, p_prd integer) returns jsonb
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
  select d.* into target
    from public.dossiers d
   where d.home_repo = lower(btrim(coalesce(p_repo, ''))) and d.kind = 'prd' and d.prd = p_prd
     and public.is_member(d.workspace_id)
   order by d.numbered_at desc nulls last, d.id
   limit 1;
  if not found then
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
          left join public.dossier_versions v on v.id = (f.value ->> 'version_id')::uuid)));
end;
$$;

revoke execute on function public.spec_says_server(text) from public, anon;
revoke execute on function public.dossier_birthplace_from_spec() from public, anon, authenticated;
revoke execute on function public.dossier_birthplace_once() from public, anon, authenticated;
revoke execute on function public.approvals_append_only() from public, anon, authenticated;
revoke execute on function public.dossier_approve(uuid) from public, anon;
revoke execute on function public.dossier_approval(text, integer) from public, anon;
grant execute on function public.dossier_approve(uuid) to authenticated;
grant execute on function public.dossier_approval(text, integer) to authenticated;
