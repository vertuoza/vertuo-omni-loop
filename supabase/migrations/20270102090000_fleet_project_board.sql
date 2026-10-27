-- A fleet's GitHub project board (PRD 2530, docs: .omni-loop/delivery/inbox/2530-fleet-project-board/spec.md).
-- A workspace's owner gives a fleet the organization project its pull requests go on, through
-- set_fleet_project(): security definer, run as the signed-in person, refused unless they own the
-- workspace (fleet_owner_only(), as every fleet function), unless the link reads as an organization
-- project of the workspace's own GitHub organization, and on a retired fleet. An empty or null link
-- clears the board, and clears its note with it.
--
-- teams.project_note and teams.project_noted_at are what the omni-loop App last did for the board
-- ("Added #12 · owner/repo", or why not). Only the service role writes them; update_fleet() is unchanged.
--
-- Every statement can run twice. Proven by supabase/checks/fleets.sql.
-- Rollback: a follow-up migration drops set_fleet_project() and the three columns.

alter table public.teams add column if not exists project_url text;
alter table public.teams add column if not exists project_note text;
alter table public.teams add column if not exists project_noted_at timestamptz;
alter table public.teams drop constraint if exists teams_project_note_length;
alter table public.teams add constraint teams_project_note_length check (char_length(project_note) <= 200);

comment on column public.teams.project_url is
  'The GitHub organization project the fleet''s pull requests go on, https://github.com/orgs/<org>/projects/<number>, <org> being the workspace''s github_org. Null: no board. Set through set_fleet_project().';
comment on column public.teams.project_note is
  'What the omni-loop App last did for the board, at most 200 characters: "Added #<n> · <owner>/<repo>", or why it could not. Written by the service role; cleared with the board.';
comment on column public.teams.project_noted_at is
  'When project_note was written.';

-- A fleet's board. `p_url` empty or null clears it (and its note); a new link drops the note of the old
-- one. Answers the saved fleet.
create or replace function public.set_fleet_project(p_workspace uuid, p_name text, p_url text)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text := btrim(coalesce(p_url, ''));
  parts text[];
  org text;
  link text;
  changed public.teams;
begin
  perform public.fleet_owner_only(p_workspace);
  if url = '' then
    update public.teams t
       set project_url = null, project_note = null, project_noted_at = null
     where t.workspace_id = p_workspace and t.name = p_name and t.retired_at is null
    returning * into changed;
  else
    parts := regexp_match(url, '^https://github\.com/orgs/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)/projects/([0-9]+)/?$');
    if parts is null then
      raise exception 'GitHub project: a link like https://github.com/orgs/<organization>/projects/<number>.'
        using errcode = '22023', hint = 'project';
    end if;
    link := 'https://github.com/orgs/' || parts[1] || '/projects/' || parts[2];
    select w.github_org into org from public.workspaces w where w.id = p_workspace;
    if org is null or lower(org) <> lower(parts[1]) then
      raise exception 'GitHub project: a project of this workspace''s own GitHub organization.'
        using errcode = '22023', hint = 'project';
    end if;
    update public.teams t
       set project_note = case when t.project_url is not distinct from link then t.project_note end,
           project_noted_at = case when t.project_url is not distinct from link then t.project_noted_at end,
           project_url = link
     where t.workspace_id = p_workspace and t.name = p_name and t.retired_at is null
    returning * into changed;
  end if;
  if not found then
    raise exception 'Fleet: no active fleet % in this workspace.', p_name using errcode = 'P0002', hint = 'name';
  end if;
  return changed;
end;
$$;

revoke execute on function public.set_fleet_project(uuid, text, text) from public, anon;
grant execute on function public.set_fleet_project(uuid, text, text) to authenticated;
