-- The PM writes the mission's own PRDs at `alone` (PRD 2896 s12, docs: .omni-loop/delivery/inbox/2896-fleet-alone/spec.md,
-- "7. The PM's own PRDs, at `alone`", criteria 19, 21 and 22). It runs after 20270123140000_mission_overturn.sql, which last set
-- the kinds of a mission event, 20270123130000_mission_committee.sql, which last set a mission key's shape and the runners'
-- fixed skills, and 20270122122000_reviewer.sql, which last set the heroes' defaults.
--
-- - runner_jobs.mission_key: also takes `mission:<id>:pm:<k>`, the mission's k-th PM job (`/omni:brainstorm`, `/omni:roadmap`,
--   or their mega forms in a plan repository): unique, so a replay of the supervisor, or two runs at once, insert it once.
-- - mission_events.kind takes two more kinds, both role pm and actor agent, written by the service role as every event of the
--   supervisor is; a member reads them and writes none:
--     prd-added     a PRD the mission's PM wrote joined the mission's scope, `added by the fleet`: the App read it from the PM job's
--                   record line, never more than `mandate.ownPrds` in all. Its prd is the PRD, its job the PM's
--     not-written   a row of the PM's roadmap the cap left unwritten, named in its sentence with `not written: the cap is <k>`; no prd
-- - set_repository_runner_skill(): its fixed list also holds `brainstorm`, `roadmap`, `mega-brainstorm` and `mega-roadmap`, the
--   list of apps/galaxy/src/runners/runners.contract.ts (RUNNER_SKILLS) and kit/lib/runner/line.ts (RUNNABLE_SKILLS). Nothing else
--   in it changes. A runner takes them on a job of a mission at `alone` only: the kit's runner and the Omni page check that.
-- - virtual_hero_roles(): the PM's limit reads `It never approves a PRD it wrote, nor one outside a mission's committee.`, the
--   kit's roles (kit/lib/virtual-fleet/roles.ts); a PM hero whose limits are still the default it was made with takes it, and a
--   hero a person changed keeps what they made of it.
--
-- Every statement can run twice. Nobody's grants change. Proven by supabase/checks/missions.sql.
-- Rollback: once no row holds a `prd-added` or `not-written` event or a `:pm:` key, a follow-up migration restores
-- runner_jobs_mission_key_shape and set_repository_runner_skill() of 20270123130000_mission_committee.sql, mission_events_kind_check
-- of 20270123140000_mission_overturn.sql and virtual_hero_roles() of 20270122122000_reviewer.sql.

-- ── The PM's job ───────────────────────────────────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:[1-9][0-9]*:(run:[1-9][0-9]*(:review:[12]|:fix:1)?|approve:[1-9][0-9]*)|pm:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>, then :review:<1 or 2> for the Reviewer''s job of that round or :fix:1 for the fix after round 1 (PRD 2871); mission:<mission id>:prd:<n>:approve:<k>, the committee''s k-th job for the PRD (PRD 2896); or mission:<mission id>:pm:<k>, the mission''s k-th PM job (PRD 2896): unique, so a replay of the supervisor, or two runs at once, insert the job once.';

-- ── What a mission did: the PM's PRDs ─────────────────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent) or not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd).';

-- ── The PM's skills are the loop's own ─────────────────────────────────────────

-- set_repository_runner_skill() of 20270123130000_mission_committee.sql, the PM's four writing skills added to its fixed list.
create or replace function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  fixed text[] := array['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add', 'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'review', 'committee', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap'];
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

-- ── What the PM never approves ────────────────────────────────────────────────

-- As 20270122122000_reviewer.sql, the PM's last limit in the kit's words: the list of kit/lib/virtual-fleet/roles.ts › ROLES, as
-- one JSON array between the $json$ markers.
create or replace function public.virtual_hero_roles() returns jsonb
language sql immutable
set search_path = ''
as $$
  select $json$[
    {"role": "engineer", "name": "Engineer", "skills": ["yolo", "yolo-fix", "wave", "do-work", "pr-care", "bug-fix", "mega-bug-fix", "ultra-yolo", "ultra-yolo-fix", "ultra-wave", "mega-pr-care", "drive", "mega-drive"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It waits for a person wherever one is needed."]},
    {"role": "qa", "name": "QA", "skills": ["prove", "bug-fix", "validate-e2e"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It reports what it saw; a person decides."]},
    {"role": "reviewer", "name": "Reviewer", "skills": ["review", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves on GitHub.", "It marks ready on its pass only.", "It raises five findings at most.", "It reviews two rounds at most."]},
    {"role": "pm", "name": "PM", "skills": ["pitch", "plan", "brainstorm", "roadmap", "mega-brainstorm", "mega-roadmap", "mission"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a PRD it wrote, nor one outside a mission's committee."]},
    {"role": "architect", "name": "Architect", "skills": ["plan", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a plan."]},
    {"role": "designer", "name": "Designer", "skills": ["visual-fix", "pixel-perfect", "think-big"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never locks a screen: a person does."]}
  ]$json$::jsonb
$$;

-- A PM's limits take the new words while they are still the default it was made with: a hero a person changed keeps what they
-- made of it.
update public.virtual_heroes h
   set limits = array(select jsonb_array_elements_text(d.value -> 'limits')),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = 'pm'
   and h.role = 'pm'
   and h.limits = array['It never merges into the default branch.', 'It never answers for a person.', 'It never approves a PRD.'];
