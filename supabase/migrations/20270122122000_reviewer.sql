-- The Reviewer (PRD 2871 s3, docs: .omni-loop/delivery/shipped/2871-reviewer/spec.md): a mission hands a PRD's
-- feature PR to the Reviewer hero before it goes ready, and the Reviewer works alone. It runs after
-- 20270122120000_runner_ultra_skills.sql and 20270122121000_heroes_every_skill.sql (PRD 2873) and builds on both.
--
-- - runner_jobs.outcome: also accepts `review` (a build or a fix sent `--for-review` left its PR a draft for
--   the Reviewer) and `changes` (the Reviewer raised findings for the Engineer to settle), the two hand-offs
--   kit/lib/runner/log.ts reads, beside today's values.
-- - runner_jobs.mission_key: also takes `mission:<id>:prd:<n>:run:<k>:review:<r>`, round 1 or 2 only, and
--   `mission:<id>:prd:<n>:run:<k>:fix:1`, the Reviewer's job and the fix after its first round: still unique,
--   so a replay of the supervisor, or two runs at once, insert each once; a third round has no key.
-- - mission_events.kind: also takes `reviewed`, a verdict of the Reviewer (role `reviewer`, actor `agent`,
--   linking its review).
-- - set_repository_runner_skill(): its fixed list also holds `review`, the list of
--   apps/galaxy/src/runners/runners.contract.ts (RUNNER_SKILLS) and kit/lib/runner/line.ts (RUNNABLE_SKILLS), so a
--   repository's own `/review` never means `/omni:review`. Nothing else in it changes.
-- - virtual_hero_roles(): the six roles of 20270122121000_heroes_every_skill.sql, the Reviewer's skills `review`
--   (it runs alone) then `tech-review` (a person's), and its six limits: the list kit/lib/virtual-fleet/roles.ts
--   holds (apps/galaxy/src/virtual-fleets/roles-sql.test.ts holds the two equal). create_virtual_fleet() and
--   add_virtual_hero() read it, so a new fleet's Reviewer, and one added later, copies them.
-- - Every Reviewer hero already made lists its role's skills, `review` among them, as
--   20270122121000_heroes_every_skill.sql did for every hero; that migration, run again, reads this
--   virtual_hero_roles() and so keeps `review`. Its limits take the six only while they are still a default
--   (PRD 2842's or PRD 2873's): a hero a person changed keeps the limits they gave it.
--
-- Every statement can run twice. Nobody's grants change: a member still reads the missions, their events,
-- their jobs and the heroes; only the service role, create_virtual_fleet() and add_virtual_hero() write.
-- Proven by supabase/checks/missions.sql and supabase/checks/virtual_fleets.sql.
-- Rollback: a follow-up migration, once no row holds `review` or `changes` as an outcome, a `reviewed` event,
-- or a `:review:` or `:fix:` key, restores runner_jobs_outcome_check of 20261229090000_api_key_job_control.sql,
-- and runner_jobs_mission_key_shape and mission_events_kind_check of 20270122093000_missions.sql (a `reviewed`
-- event is never deleted, mission_events being append only, so the kind stays while one exists); restores
-- set_repository_runner_skill() of 20270122120000_runner_ultra_skills.sql and virtual_hero_roles() of
-- 20270122121000_heroes_every_skill.sql; and sets the Reviewer heroes whose skills and limits are this
-- migration's back to that one's defaults.

-- ── A job's end: the Reviewer's two hand-offs ───────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_outcome_check;
alter table public.runner_jobs add constraint runner_jobs_outcome_check check (outcome in (
  'answers', 'held', 'ready', 'human', 'stopped',
  'pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked',
  'review', 'changes'));

comment on column public.runner_jobs.outcome is
  'What a done job ended on: answers, held, ready or stopped (a yolo hand-off, PRDs 2223 and 2375), human (PRD 2255: it ended with its questions open), pr-opened, already-fixed, needs-brainstorm, not-a-bug, stuck or blocked (PRD 2425: a bug fix''s ending), or review or changes (PRD 2871: the PR waits for the Reviewer, or the Reviewer asked for changes). Null for any other job.';

-- ── The keys of the Reviewer's job and of the fix after it ──────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:prd:[1-9][0-9]*:run:[1-9][0-9]*(:review:[12]|:fix:1)?$');

comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>, then :review:<1 or 2> for the Reviewer''s job of that round or :fix:1 for the fix after round 1 (PRD 2871): unique, so a replay of the supervisor, or two runs at once, insert the job once.';

-- ── What a mission did: the Reviewer's verdict ──────────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), or reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review).';

-- ── `review` is the loop's own skill ────────────────────────────────────────────

-- set_repository_runner_skill() of 20270122120000_runner_ultra_skills.sql, `review` added to its fixed list.
create or replace function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  fixed text[] := array['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add', 'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'review'];
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

-- ── The Reviewer works alone ────────────────────────────────────────────────────

-- As 20270122121000_heroes_every_skill.sql, the Reviewer given `review` before `tech-review`, and its six limits:
-- the list of kit/lib/virtual-fleet/roles.ts › ROLES, as one JSON array between the $json$ markers.
create or replace function public.virtual_hero_roles() returns jsonb
language sql immutable
set search_path = ''
as $$
  select $json$[
    {"role": "engineer", "name": "Engineer", "skills": ["yolo", "yolo-fix", "wave", "do-work", "pr-care", "bug-fix", "mega-bug-fix", "ultra-yolo", "ultra-yolo-fix", "ultra-wave", "mega-pr-care", "drive", "mega-drive"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It waits for a person wherever one is needed."]},
    {"role": "qa", "name": "QA", "skills": ["prove", "bug-fix", "validate-e2e"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It reports what it saw; a person decides."]},
    {"role": "reviewer", "name": "Reviewer", "skills": ["review", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves on GitHub.", "It marks ready on its pass only.", "It raises five findings at most.", "It reviews two rounds at most."]},
    {"role": "pm", "name": "PM", "skills": ["pitch", "plan", "brainstorm", "roadmap", "mega-brainstorm", "mega-roadmap", "mission"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a PRD."]},
    {"role": "architect", "name": "Architect", "skills": ["plan", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a plan."]},
    {"role": "designer", "name": "Designer", "skills": ["visual-fix", "pixel-perfect", "think-big"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never locks a screen: a person does."]}
  ]$json$::jsonb
$$;

-- Every Reviewer hero already made lists its role's skills, `review` first, as heroes_every_skill did for every
-- hero: only its skills here.
update public.virtual_heroes h
   set skills = array(select s.value from jsonb_array_elements_text(d.value -> 'skills') with ordinality as s (value, n) order by s.n),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = 'reviewer'
   and h.role = 'reviewer'
   and h.skills is distinct from array(select s.value from jsonb_array_elements_text(d.value -> 'skills') with ordinality as s (value, n) order by s.n);

-- Its limits take the six while they are still a default, PRD 2842's (no skill to run yet) or PRD 2873's (never
-- approves a pull request): a hero a person changed keeps what they made of it.
update public.virtual_heroes h
   set limits = array(select jsonb_array_elements_text(d.value -> 'limits')),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = 'reviewer'
   and h.role = 'reviewer'
   and h.limits in (array['It never merges into the default branch.', 'It never answers for a person.', 'It has no skill to run yet.'],
                    array['It never merges into the default branch.', 'It never answers for a person.', 'It never approves a pull request.']);
