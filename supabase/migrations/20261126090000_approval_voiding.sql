-- Voiding an approval on `omni dossier push` (PRD 1322 s6, docs:
-- .omni-loop/delivery/inbox/1322-approval-handshake/spec.md §7).
--
-- - approval_voids.version_id: the version whose push voided the approval. The table is s2's
--   (20261125090000_approval_requests.sql), and nothing wrote it before this migration, so the column
--   is required from the start.
-- - dossier_push(): as 20261119090000_concept_dossiers.sql, and, for a PRD, adding a version of a kind
--   the approval in force pinned with another sha256 appends an approval_voids row in the same
--   transaction (the approval, the kind, the pinned and the new hash, who pushed, the new version). The
--   approval in force is the dossier's latest approval with no void; it is read once, before the
--   versions are added, so every pinned kind a push changes leaves its own row. The approval is never
--   edited. Its answer is unchanged.
-- - dossier_approval(): as 20261123090000_approvals.sql, the approval now carries `voids`, each
--   {pusher, kind, from, to, voidedAt}, oldest first: an approval with a void is no longer in force,
--   and the kit reads it as drifted, naming the push.
-- - approval_voids_of_push(dossier): the voids the caller's last push of the dossier left, for the
--   push route, which tells each voided approval's approver.
-- - approval_void_recipients(void): how that approver is reached, for the server's service role only,
--   in approval_recipients()'s shape.
--
-- Proven by supabase/checks/approval_voiding.sql.
--
-- Rollback: a follow-up migration restores dossier_push() of 20261119090000_concept_dossiers.sql and
-- dossier_approval() of 20261123090000_approvals.sql, drops the two functions and the column.

-- ── The version that voided ──────────────────────────────────────────────────────

alter table public.approval_voids
  add column version_id uuid not null references public.dossier_versions on delete cascade;

comment on column public.approval_voids.version_id is
  'PRD 1322: the version whose push voided the approval: its kind is the row''s kind, its sha256 the row''s to_sha256.';

create index approval_voids_approval_idx on public.approval_voids (approval_id, voided_at, id);

-- ── The kit's push, voiding a changed pinned file ────────────────────────────────

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
  in_force  public.approvals%rowtype;
  pinned    text;
  latest    public.dossier_versions%rowtype;
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

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged);
end;
$$;

-- ── What the kit reads ───────────────────────────────────────────────────────────

-- As 20261123090000_approvals.sql, with the approval's `voids`: [{pusher, kind, from, to, voidedAt}],
-- oldest first, empty while it is in force.
create or replace function public.dossier_approval(p_repo text, p_prd integer) returns jsonb
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

-- ── Telling the approver ─────────────────────────────────────────────────────────

-- The voids the caller's last push of dossier `p_dossier` left: those the caller pushed whose version
-- is still the latest of its kind. [{id, dossier, repo, prd, title, kind, from, to, pusher, approver}],
-- oldest first; [] to anyone who reads no such dossier.
create function public.approval_voids_of_push(p_dossier uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'dossier', d.id, 'repo', d.home_repo, 'prd', d.prd, 'title', d.title,
           'kind', x.kind, 'from', x.from_sha256, 'to', x.to_sha256,
           'pusher', x.pusher_login, 'approver', a.approver_login)
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

-- How the approver a void voided is reached, in approval_recipients()'s shape: [] when they left the
-- workspace. For the server's service role only: it reads addresses no member reads.
create function public.approval_void_recipients(p_void uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user', a.approved_by,
           'email', case when c.email then au.email end,
           'devices', case when c.push then (
             select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                                       order by s.created_at, s.id), '[]'::jsonb)
               from public.push_subscriptions s where s.user_id = a.approved_by) else '[]'::jsonb end)), '[]'::jsonb)
    from public.approval_voids x
    join public.approvals a on a.id = x.approval_id
    join public.dossiers d on d.id = x.dossier_id
    join public.workspace_members m on m.workspace_id = d.workspace_id and m.user_id = a.approved_by
    left join public.alert_channels c on c.user_id = a.approved_by
    left join auth.users au on au.id = a.approved_by
   where x.id = p_void
$$;

revoke execute on function public.approval_voids_of_push(uuid) from public, anon;
revoke execute on function public.approval_void_recipients(uuid) from public, anon, authenticated;
grant execute on function public.approval_voids_of_push(uuid) to authenticated;
grant execute on function public.approval_void_recipients(uuid) to service_role;
