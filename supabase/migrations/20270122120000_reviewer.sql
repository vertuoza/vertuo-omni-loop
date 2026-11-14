-- The Reviewer (PRD 2871 s3, docs: .omni-loop/delivery/inbox/2871-reviewer/spec.md): a mission hands a PRD's
-- feature PR to the Reviewer hero before it goes ready, and the Reviewer works alone.
--
-- - runner_jobs.outcome: also accepts `review` (a build or a fix sent `--for-review` left its PR a draft for
--   the Reviewer) and `changes` (the Reviewer raised findings for the Engineer to settle), the two hand-offs
--   kit/lib/runner/log.ts reads, beside today's values.
-- - runner_jobs.mission_key: also takes `mission:<id>:prd:<n>:run:<k>:review:<r>`, round 1 or 2 only, and
--   `mission:<id>:prd:<n>:run:<k>:fix:1`, the Reviewer's job and the fix after its first round: still unique,
--   so a replay of the supervisor, or two runs at once, insert each once; a third round has no key.
-- - mission_events.kind: also takes `reviewed`, a verdict of the Reviewer (role `reviewer`, actor `agent`,
--   linking its review).
-- - virtual_hero_roles(): the Reviewer's defaults are the list kit/lib/virtual-fleet/roles.ts holds
--   (apps/galaxy/src/virtual-fleets/roles-sql.test.ts holds the two equal): its skill `review` and its six
--   limits. A new fleet's Reviewer, and one added later, copies them.
-- - The Reviewer heroes of fleets made before this migration take the same skill and limits, unless a person
--   edited that hero: only a hero whose skills and limits are still the old defaults, exactly, is updated.
--
-- Every statement can run twice. Nobody's grants change: a member still reads the missions, their events,
-- their jobs and the heroes; only the service role, create_virtual_fleet() and add_virtual_hero() write.
-- Proven by supabase/checks/missions.sql.
-- Rollback: a follow-up migration, once no row holds `review` or `changes` as an outcome, a `reviewed` event,
-- or a `:review:` or `:fix:` key, restores runner_jobs_outcome_check of 20261229090000_api_key_job_control.sql,
-- and runner_jobs_mission_key_shape and mission_events_kind_check of 20270122093000_missions.sql (a `reviewed`
-- event is never deleted, mission_events being append only, so the kind stays while one exists); restores
-- virtual_hero_roles() of 20270122090000_virtual_fleets.sql; and sets the Reviewer heroes whose skills and
-- limits are this migration's back to the old defaults.

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

-- ── The Reviewer works alone ────────────────────────────────────────────────────

-- As 20270122090000_virtual_fleets.sql, the Reviewer given its skill and its six limits: the list of
-- kit/lib/virtual-fleet/roles.ts › ROLES, as one JSON array between the $json$ markers.
create or replace function public.virtual_hero_roles() returns jsonb
language sql immutable
set search_path = ''
as $$
  select $json$[
    {"role": "engineer", "name": "Engineer", "skills": ["yolo", "yolo-fix", "wave", "do-work", "pr-care", "bug-fix"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It waits for a person wherever one is needed."]},
    {"role": "qa", "name": "QA", "skills": ["prove", "bug-fix"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It reports what it saw; a person decides."]},
    {"role": "reviewer", "name": "Reviewer", "skills": ["review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves on GitHub.", "It marks ready on its pass only.", "It raises five findings at most.", "It reviews two rounds at most."]},
    {"role": "pm", "name": "PM", "skills": ["pitch", "plan"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a PRD."]},
    {"role": "architect", "name": "Architect", "skills": ["plan"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a plan."]}
  ]$json$::jsonb
$$;

-- The Reviewer heroes made before this migration, still on the old defaults (no skill, and the three limits
-- 20270122090000_virtual_fleets.sql gave them): a hero a person changed keeps what they made of it.
update public.virtual_heroes h
   set skills = array(select jsonb_array_elements_text(d.value -> 'skills')),
       limits = array(select jsonb_array_elements_text(d.value -> 'limits')),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = 'reviewer'
   and h.role = 'reviewer'
   and h.skills = '{}'::text[]
   and h.limits = array['It never merges into the default branch.', 'It never answers for a person.', 'It has no skill to run yet.'];
