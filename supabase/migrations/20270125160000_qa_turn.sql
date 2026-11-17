-- QA checks a mission's PRD and hands its bugs to the Engineer (PRD 3001 s2, docs: .omni-loop/delivery/inbox/3001-qa-turn/spec.md,
-- sections 1, 2, 5 and 6). It runs after 20270125140000_mission_repairs.sql, which last set a mission key's shape, the kinds of a
-- mission event, the runners' fixed skills and the heroes' defaults.
--
-- - runner_jobs.tokens: the column of 20261212090000_runner_tokens.sql (PRD 2102), still nullable, now checked as
--   ask_rounds.tokens is: {input, output, cacheRead, cacheWrite}, each a whole number >= 0, or null when the agent gave none.
-- - mission_events.kind: also takes `checked`, a verdict of QA (role qa, actor agent, its round and its bugs' issues in its
--   sentence, linking its comment), as `reviewed` carries the Reviewer's. The role `qa` an event already takes.
-- - runner_jobs.mission_key: also takes `mission:<id>:prd:<n>:run:<k>:qa:<1 or 2>`, QA's job of that round, and
--   `mission:<id>:prd:<n>:run:<k>:qa-fix:1:<1 to 5>`, the Engineer's fix of the k-th bug of round 1: unique, so a replay of the
--   supervisor, or two runs at once, insert each once; a third round and a sixth bug have no key.
-- - set_repository_runner_skill(): its fixed list also holds `qa`, so a repository's own `/qa` never means `/omni:qa`.
-- - virtual_hero_roles(): QA's skills become qa, prove, bug-fix and validate-e2e, and its limits, after every hero's two,
--   It never writes the branch., It reports bugs to the Engineer., It reports five bugs at most. and It checks two rounds at
--   most.: the list kit/lib/virtual-fleet/roles.ts holds (apps/galaxy/src/virtual-fleets/roles-sql.test.ts holds the two
--   equal). A QA whose skills, or whose limits, are still the default it was made with takes the new ones; a hero a person
--   changed keeps what they made of it.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written (BR-PRODUCT-12, 28, 29, 39,
-- 59, 63, 64); a mission event is only ever added (N-PRODUCT-16). A job's tokens are counts, never a credential (L-GDPR-2).
--
-- Every statement can run twice. Nobody's grants change.
-- Proven by supabase/checks/qa_turn.sql.
-- Rollback: once no row holds a `checked` event or a `:qa:` or `:qa-fix:` key, a follow-up migration drops
-- runner_jobs_tokens_shape and restores runner_jobs_mission_key_shape, mission_events_kind_check (a `checked` event is never
-- deleted, mission_events being append only, so the kind stays while one exists), set_repository_runner_skill() and
-- virtual_hero_roles() of 20270125140000_mission_repairs.sql. A QA keeps its skills and limits until a person changes them.

-- ── A job's tokens ──────────────────────────────────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_tokens_shape;
alter table public.runner_jobs add constraint runner_jobs_tokens_shape check (tokens is null or public.ask_tokens_valid(tokens));

comment on column public.runner_jobs.tokens is
  'The tokens of the job (PRD 2102, PRD 3001): {input, output, cacheRead, cacheWrite}, whole numbers >= 0, as its runner last reported them, the report that ends it carrying its agent''s count of the run. Null when it never did, or when the agent gave none.';

-- ── What a mission did: QA's verdict ────────────────────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written',
  'repair-started', 'retro', 'repair-ended', 'bug-reported', 'checked'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent), not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd), repair-started, retro, repair-ended and bug-reported (PRD 2980: a repair was sent, its retro named the cause, it ended, or the App filed an Omni Loop bug report; actor agent, each one sentence and one link, naming its fingerprint''s first 8 characters), or checked (PRD 3001: a verdict of QA, role qa, actor agent, its round and its bugs'' issues in its sentence, linking its comment).';

-- ── The keys of QA's jobs and of the fixes between them ─────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:[1-9][0-9]*:(run:[1-9][0-9]*(:review:[12]|:fix:1|:qa:[12]|:qa-fix:1:[1-5])?|approve:[1-9][0-9]*|repair:[1-9][0-9]*)|pm:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>, then :review:<1 or 2> for the Reviewer''s job of that round or :fix:1 for the fix after round 1 (PRD 2871), or :qa:<1 or 2> for QA''s job of that round or :qa-fix:1:<1 to 5> for the Engineer''s fix of a bug of round 1 (PRD 3001); mission:<mission id>:prd:<n>:approve:<k>, the committee''s k-th job for the PRD (PRD 2896); mission:<mission id>:prd:<n>:repair:<k>, the PRD''s k-th repair (PRD 2980); or mission:<mission id>:pm:<k>, the mission''s k-th PM job (PRD 2896): unique, so a replay of the supervisor, or two runs at once, insert the job once.';

-- ── /omni:qa is the loop's own skill ────────────────────────────────────────────

-- set_repository_runner_skill() of 20270125140000_mission_repairs.sql, `qa` added to its fixed list.
create or replace function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  fixed text[] := array['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add', 'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'review', 'committee', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap', 'repair', 'qa'];
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

-- ── QA checks, reports, and writes no branch ────────────────────────────────────

-- As 20270125140000_mission_repairs.sql, QA's skills and limits changed: the list of kit/lib/virtual-fleet/roles.ts › ROLES, as
-- one JSON array between the $json$ markers.
create or replace function public.virtual_hero_roles() returns jsonb
language sql immutable
set search_path = ''
as $$
  select $json$[
    {"role": "engineer", "name": "Engineer", "skills": ["yolo", "yolo-fix", "wave", "do-work", "pr-care", "bug-fix", "mega-bug-fix", "ultra-yolo", "ultra-yolo-fix", "ultra-wave", "mega-pr-care", "drive", "mega-drive", "repair"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It waits for a person wherever one is needed."]},
    {"role": "qa", "name": "QA", "skills": ["qa", "prove", "bug-fix", "validate-e2e"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never writes the branch.", "It reports bugs to the Engineer.", "It reports five bugs at most.", "It checks two rounds at most."]},
    {"role": "reviewer", "name": "Reviewer", "skills": ["review", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves on GitHub.", "It marks ready on its pass only.", "It raises five findings at most.", "It reviews two rounds at most."]},
    {"role": "pm", "name": "PM", "skills": ["pitch", "plan", "brainstorm", "roadmap", "mega-brainstorm", "mega-roadmap", "mission"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a PRD it wrote, nor one outside a mission's committee."]},
    {"role": "architect", "name": "Architect", "skills": ["plan", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a plan."]},
    {"role": "designer", "name": "Designer", "skills": ["visual-fix", "pixel-perfect", "think-big"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never locks a screen: a person does."]}
  ]$json$::jsonb
$$;

-- A QA's skills take `qa` while they are still the default it was made with, and its limits take the four while they are still
-- theirs: a hero a person changed keeps what they made of it.
update public.virtual_heroes h
   set skills = array(select jsonb_array_elements_text(d.value -> 'skills')),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = 'qa'
   and h.role = 'qa'
   and h.skills = array['prove', 'bug-fix', 'validate-e2e'];

update public.virtual_heroes h
   set limits = array(select jsonb_array_elements_text(d.value -> 'limits')),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = 'qa'
   and h.role = 'qa'
   and h.limits = array['It never merges into the default branch.', 'It never answers for a person.', 'It reports what it saw; a person decides.'];
