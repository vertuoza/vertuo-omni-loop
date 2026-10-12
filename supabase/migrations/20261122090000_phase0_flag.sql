-- Where a repository's phase 0 is approved (PRD 1299 s1, docs:
-- .omni-loop/delivery/inbox/1299-server-approval/spec.md §1).
--
-- - repositories.phase0: `pr` (a docs-only phase-0 pull request, as today) or `server` (approved on the
--   PRD page), `pr` by default. Only the workspace's owner switches it, through set_repository_phase0(),
--   built like set_repository_tracked() of 20261008090000_repositories.sql: security definer, run as the
--   signed-in person, refusing anyone else with 42501. Switching it changes no PRD that already exists.
-- - repository_phase0() answers the kit (`GET /api/repositories/phase0?repo=`) the flag of `repo` in the
--   workspace the signed-in person's call goes to (business_workspace(): 42501 outside the caller's
--   workspaces), `pr` for a repository the workspace does not list.
--
-- Rollback: a follow-up migration drops repository_phase0(), set_repository_phase0() and
-- repositories.phase0. Every repository reads `pr` until an owner switches one, so nothing changes
-- before that.

-- ── The flag ─────────────────────────────────────────────────────────────────────

alter table public.repositories
  add column phase0 text not null default 'pr' check (phase0 in ('pr', 'server'));

comment on column public.repositories.phase0 is
  'Where the repository''s phase 0 is approved (PRD 1299): pr, a docs-only phase-0 pull request; server, the PRD page. pr by default; only the workspace''s owner switches it, through set_repository_phase0().';

-- ── Who may switch it ────────────────────────────────────────────────────────────

-- Switches a repository's phase 0 to `pr` or `server`. The owner's only.
create function public.set_repository_phase0(p_workspace uuid, p_full_name text, p_phase0 text) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.repositories;
begin
  perform public.repository_owner_only(p_workspace);
  if p_phase0 is null or p_phase0 not in ('pr', 'server') then
    raise exception 'Phase 0: pr or server.' using errcode = '22023', hint = 'phase0';
  end if;
  update public.repositories r
     set phase0 = p_phase0
   where r.workspace_id = p_workspace and r.full_name = lower(btrim(coalesce(p_full_name, '')))
  returning * into changed;
  if not found then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  return changed;
end;
$$;

-- ── What the kit calls ───────────────────────────────────────────────────────────

-- The phase 0 of `repo` for the signed-in person's terminal: `pr` when the workspace does not list it.
-- 42501 outside the caller's workspaces, 22023 a malformed repository, as business_workspace() says.
create function public.repository_phase0(p_repo text) returns text
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  found_one text;
begin
  select r.phase0 into found_one
    from public.repositories r
   where r.workspace_id = ws and r.full_name = lower(btrim(p_repo));
  return coalesce(found_one, 'pr');
end;
$$;

revoke execute on function public.set_repository_phase0(uuid, text, text) from public, anon;
grant execute on function public.set_repository_phase0(uuid, text, text) to authenticated;
revoke execute on function public.repository_phase0(text) from public, anon;
grant execute on function public.repository_phase0(text) to authenticated;
