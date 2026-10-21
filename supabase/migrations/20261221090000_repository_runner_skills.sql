-- A repository allows its own skills on a runner (PRD 2313, docs:
-- .omni-loop/delivery/inbox/2313-runner-repo-skills/spec.md, "The data").
--
-- - repository_runner_skills: one row per (workspace, repository, skill) a workspace's owner allowed on
--   its runners, with who allowed it and when. The allowance holds by name: a later change to the
--   skill's SKILL.md keeps it. Turning it off deletes the row. A member of the workspace reads the rows;
--   nobody signed in writes them but through set_repository_runner_skill().
-- - set_repository_runner_skill(): built like set_repository_phase0() of 20261122090000_phase0_flag.sql:
--   security definer, run as the signed-in person, refusing anyone but the workspace's owner with 42501.
--   It refuses a malformed name or a name on the runners' fixed list with 22023 (hint `skill`), so `/yolo`
--   never means `/omni:yolo`, and a repository the workspace does not list, or removed, with P0002 (hint
--   `full_name`). The fixed list is the one in apps/galaxy/src/runners/runners.contract.ts and
--   kit/lib/runner/line.ts; runners.skills.migration.test.ts holds the three equal.
-- - repository_runner_skills_of(): the allowed names of a repository, in order, an empty list when none,
--   which the app's queue() and a runner's claim read. It runs as its caller: the routes' service role
--   reads any workspace's, a member only their own.
--
-- Nothing changes before an owner allows a skill: every list reads empty.
--
-- Rollback: a follow-up migration drops repository_runner_skills_of(), set_repository_runner_skill()
-- and the table. Nothing else reads them.

-- ── The allowance ────────────────────────────────────────────────────────────────

create table public.repository_runner_skills (
  workspace_id uuid not null,
  full_name    text not null,
  skill        text not null check (skill ~ '^[a-z][a-z0-9-]*$' and char_length(skill) <= 64),
  allowed_by   uuid references auth.users on delete set null,
  allowed_at   timestamptz not null default now(),
  primary key (workspace_id, full_name, skill),
  foreign key (workspace_id, full_name) references public.repositories (workspace_id, full_name) on delete cascade
);

comment on table public.repository_runner_skills is
  'The skills of a repository''s own (.claude/skills/<name>/SKILL.md on its default branch) its workspace''s owner allowed on the runners (PRD 2313), by name: a later change to the SKILL.md keeps the allowance. Only the owner writes it, through set_repository_runner_skill(); turning a skill off deletes its row.';

-- ── Who may allow one ────────────────────────────────────────────────────────────

-- Allows a repository's own skill on the runners, or takes the allowance back. The owner's only.
create function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  fixed text[] := array['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove'];
begin
  perform public.repository_owner_only(p_workspace);
  if p_skill is null or p_skill !~ '^[a-z][a-z0-9-]*$' or char_length(p_skill) > 64 then
    raise exception 'Skill: a skill''s name, as its folder under .claude/skills/ spells it.' using errcode = '22023', hint = 'skill';
  end if;
  if p_skill = any (fixed) then
    raise exception 'Skill: /% is the loop''s own skill, which a runner runs as /omni:%.', p_skill, p_skill using errcode = '22023', hint = 'skill';
  end if;
  if p_allowed is null then
    raise exception 'Allow on runner: on or off.' using errcode = '22023', hint = 'allowed';
  end if;
  if not exists (select 1 from public.repositories r where r.workspace_id = p_workspace and r.full_name = name and r.removed_at is null) then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  if p_allowed then
    insert into public.repository_runner_skills (workspace_id, full_name, skill, allowed_by)
    values (p_workspace, name, p_skill, auth.uid())
    on conflict (workspace_id, full_name, skill) do nothing;
  else
    delete from public.repository_runner_skills s
     where s.workspace_id = p_workspace and s.full_name = name and s.skill = p_skill;
  end if;
end;
$$;

-- ── What the runners read ────────────────────────────────────────────────────────

-- The names a repository allowed on the runners, in order; an empty list when none.
create function public.repository_runner_skills_of(p_workspace uuid, p_full_name text) returns text[]
language sql stable
set search_path = ''
as $$
  select coalesce(array_agg(s.skill order by s.skill), '{}')
    from public.repository_runner_skills s
   where s.workspace_id = p_workspace and s.full_name = lower(btrim(coalesce(p_full_name, '')));
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.repository_runner_skills enable row level security;

create policy "a member reads their workspace's runner skills" on public.repository_runner_skills
  for select to authenticated using (public.is_member(workspace_id));

-- Signed out: nothing. Signed in: reads only, the rows above. The service role reads everything. Only
-- set_repository_runner_skill() writes.
revoke all on public.repository_runner_skills from public, anon, authenticated, service_role;
grant select on public.repository_runner_skills to authenticated, service_role;

revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;
grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;
revoke execute on function public.repository_runner_skills_of(uuid, text) from public, anon;
grant execute on function public.repository_runner_skills_of(uuid, text) to authenticated, service_role;
