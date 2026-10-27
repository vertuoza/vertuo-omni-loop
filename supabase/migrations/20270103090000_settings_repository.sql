-- The workspace's settings repository, its own setting (PRD 2543 s1, docs:
-- .omni-loop/delivery/inbox/2543-settings-repository/spec.md › Solution 1).
--
-- - workspaces.settings_repository: the repository whose pages the Omni settings level of the playbook
--   reads (PRD 2417), `owner/name` in lower case, or null while none is chosen. The galaxy reads it
--   first and falls back to plan_repo while it is null, so the migration fills nothing: every workspace
--   reads exactly what it read before. The game, the dossiers and the points keep reading plan_repo.
-- - set_workspace_settings_repository() chooses it or clears it. The owner's only, built like
--   set_repository_phase0() of 20261122090000_phase0_flag.sql: security definer, run as the signed-in
--   person, refusing anyone else with 42501 (repository_owner_only()). The name is trimmed and
--   lowercased and must be a repository the workspace lists and has not removed, else P0002 with the
--   hint `full_name`; null or an empty name clears the choice. It answers the workspace row it saved.
--   Removing a repository later keeps the choice (remove_repository() is unchanged; spec › Decisions).
--
-- Rollback: a follow-up migration drops set_workspace_settings_repository() and
-- workspaces.settings_repository. Any choice an owner made is lost, and the playbook reads the plan
-- repository again.

-- ── The setting ──────────────────────────────────────────────────────────────────

alter table public.workspaces add column settings_repository text;

comment on column public.workspaces.settings_repository is
  'The repository the playbook''s Omni settings level reads (PRD 2543), owner/name in lower case; null while none is chosen, and the plan repository is read instead. Only the workspace''s owner sets it, through set_workspace_settings_repository().';

-- ── Who may choose it ────────────────────────────────────────────────────────────

-- Chooses the workspace's settings repository among the repositories it lists, or clears the choice
-- (null or empty). The owner's only.
create function public.set_workspace_settings_repository(p_workspace uuid, p_full_name text) returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen text := nullif(lower(btrim(coalesce(p_full_name, ''))), '');
  changed public.workspaces;
begin
  perform public.repository_owner_only(p_workspace);
  if chosen is not null and not exists (
    select 1 from public.repositories r
     where r.workspace_id = p_workspace and r.full_name = chosen and r.removed_at is null
  ) then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  update public.workspaces w
     set settings_repository = chosen
   where w.id = p_workspace
  returning * into changed;
  return changed;
end;
$$;

revoke execute on function public.set_workspace_settings_repository(uuid, text) from public, anon;
grant execute on function public.set_workspace_settings_repository(uuid, text) to authenticated;
