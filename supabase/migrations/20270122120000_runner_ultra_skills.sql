-- Runners take the ultra skills (PRD 2873 s1, docs: .omni-loop/delivery/inbox/2873-heroes-every-skill/spec.md,
-- "Runners take the ultra skills").
--
-- - set_repository_runner_skill() (20261222090000_repository_runner_skills.sql) refuses a repository's own skill
--   named like one of the loop's own, so `/ultra-yolo` never means `/omni:ultra-yolo`. Its fixed list lacked the
--   skills runners took after it shipped: retro-apply (PRD 2338), rewind and knowledge-add (PRD 2410) and
--   rewind-apply (PRD 2498); and now the three ultra skills, ultra-yolo, ultra-wave and ultra-yolo-fix. The
--   function is replaced with the whole list, the one in apps/galaxy/src/runners/runners.contract.ts
--   (RUNNER_SKILLS) and kit/lib/runner/line.ts (RUNNABLE_SKILLS); runners.ultra-skills.migration.test.ts holds the
--   database's equal to the app's, and runners.contract.test.ts the app's to the kit's. Nothing else in it changes:
--   the same signature, rules, words and grants.
--
-- No row changes. A repository's own skill already allowed under one of the seven names stays allowed, and never
-- runs: the line check refuses `/<name>` for a fixed skill's name, on the server and on the runner alike.
--
-- Rollback: a follow-up migration that replaces set_repository_runner_skill() with its body in
-- 20261222090000_repository_runner_skills.sql. Nothing else reads the list.

create or replace function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  fixed text[] := array['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add', 'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix'];
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

-- `create or replace` keeps the grants; they are stated again so this file reads whole.
revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;
grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;
